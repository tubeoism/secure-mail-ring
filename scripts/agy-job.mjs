// Async runner for Antigravity (CL-12, docs/tasks/CL-12.md).
//
// A job is a directory under .tools/agy-jobs/<id>/ (git-ignored). Claude writes job.json, starts
// `node scripts/agy-job.mjs run <id>` as a background shell command, and is woken when it exits.
// agy runs with `--output-format stream-json`, so every step is an event on stdout: that stream is
// the liveness signal. A run that emits nothing for `idleSeconds` is killed and its partial text is
// kept. The job never writes to the repository, and its cwd is never the repo root.
//
// Commands: run <id> | status <id> | result <id> | cancel <id>
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { clearInterval, setInterval } from "node:timers";
import { fileURLToPath } from "node:url";
import { evaluate } from "./agy-guard.mjs";

export const EXIT = {
  OK: 0,
  USAGE: 2,
  IDLE: 10,
  HARD: 11,
  QUOTA: 12,
  ERROR: 13,
  DENIED: 14,
  CANCELLED: 15,
};

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const MAX_PROMPT = 24_000; // stays under the Windows command-line limit
const QUOTA_RE = /quota|rate[ _-]?limit|RESOURCE_EXHAUSTED|(?<!\d)429(?!\d)|too many requests/i;

/** Appended to every prompt: headless agy cannot answer permission prompts, so a command stalls it. */
export const CONSTRAINT =
  "\n\nConstraints: you have no command execution and no network. Do not try to run code, tests or shell commands, and do not create, edit or delete any file. Reason only by reading the files you are told to read. Reply with text only.";

const clamp = (n, lo, hi, fallback) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;

export function jobDir(root, id) {
  if (!ID_RE.test(id)) throw new Error("job id must be 3-40 chars of a-z, 0-9 and '-'");
  return path.join(root, ".tools", "agy-jobs", id);
}

/** Seconds until quota resets from prose like "resets in 4 hours and 50 minutes". */
export function parseResetSeconds(text) {
  const units = { h: 3600, m: 60, s: 1 };
  const seen = {};
  for (const [, n, u] of text
    .toLowerCase()
    .matchAll(/(\d+)\s*(h|m|s)(?:ours?|rs?|inutes?|ins?|econds?|ecs?)?(?![a-z])/g)) {
    seen[u] ??= Number(n);
  }
  const keys = Object.keys(seen);
  return keys.length ? keys.reduce((sum, u) => sum + seen[u] * units[u], 0) : null;
}

export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

export function killTree(pid) {
  if (!isAlive(pid)) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function readJob(dir) {
  const job = JSON.parse(fs.readFileSync(path.join(dir, "job.json"), "utf8"));
  if (typeof job.prompt !== "string" || job.prompt.trim() === "")
    throw new Error("job.json: prompt");
  if (job.prompt.length > MAX_PROMPT) throw new Error(`job.json: prompt over ${MAX_PROMPT} chars`);
  return {
    prompt: job.prompt,
    add_dir: Array.isArray(job.add_dir) ? job.add_dir : [],
    workspace: job.workspace,
    model: typeof job.model === "string" ? job.model : undefined,
    idleSeconds: clamp(job.idleSeconds, 1, 900, 180),
    hardSeconds: clamp(job.hardSeconds, 5, 7200, 1800),
  };
}

/**
 * Runs one job to the end and returns an EXIT code. `opts.agy` replaces the agy binary in tests.
 * @param {string} id
 * @param {{ root?: string, agy?: { command: string, prefixArgs?: string[] }, env?: object, tickMs?: number }} [opts]
 */
export async function runJob(id, opts = {}) {
  const root = opts.root ?? REPO_ROOT;
  const dir = jobDir(root, id);
  const eventsFile = path.join(dir, "events.ndjson");
  const statusFile = path.join(dir, "status.json");
  const resultFile = path.join(dir, "result.md");
  const status = {
    id,
    state: "starting",
    workerPid: process.pid,
    agyPid: null,
    startedAt: new Date().toISOString(),
    lastActivityAt: null,
    steps: 0,
    conversationId: null,
    idleSeconds: null,
    hardSeconds: null,
    exitCode: null,
    detail: null,
    resetSeconds: null,
  };
  const save = () => writeJson(statusFile, status);
  const finish = (state, exitCode, detail = null) => {
    status.state = state;
    status.exitCode = exitCode;
    status.detail = detail;
    save();
    return exitCode;
  };

  let job;
  try {
    job = readJob(dir);
  } catch (e) {
    fs.mkdirSync(dir, { recursive: true });
    return finish("error", EXIT.ERROR, `cannot read job: ${e.message}`);
  }
  status.idleSeconds = job.idleSeconds;
  status.hardSeconds = job.hardSeconds;

  const verdict = evaluate(
    "mcp__antigravity__agy_ask",
    { prompt: job.prompt, add_dir: job.add_dir, workspace: job.workspace },
    root,
  );
  if (!verdict.allow) return finish("denied", EXIT.DENIED, verdict.reason);

  // agy's cwd is never the repo root: the first added directory, or an empty scratch directory.
  let cwd = path.join(dir, "cwd");
  if (job.add_dir.length > 0) cwd = path.resolve(root, job.add_dir[0]);
  else fs.mkdirSync(cwd, { recursive: true });

  const args = [
    "--output-format",
    "stream-json",
    // Plan mode blocks file writes and commands. T7 showed that without it agy's file tools write
    // anywhere on disk in headless mode, whatever --add-dir says.
    "--mode",
    "plan",
    "--print-timeout",
    `${Math.max(1, job.hardSeconds - 15)}s`,
    ...job.add_dir.flatMap((d) => ["--add-dir", path.resolve(root, d)]),
    ...(job.model ? ["--model", job.model] : []),
    "-p",
    job.prompt + CONSTRAINT,
  ];
  const agy = opts.agy ?? { command: "agy", prefixArgs: [] };
  fs.writeFileSync(eventsFile, "");

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(agy.command, [...(agy.prefixArgs ?? []), ...args], {
        cwd,
        env: { ...process.env, ...opts.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform !== "win32",
      });
    } catch (e) {
      resolve(finish("error", EXIT.ERROR, `cannot start agy: ${e.message}`));
      return;
    }
    status.agyPid = child.pid ?? null;
    status.state = "running";
    status.lastActivityAt = new Date().toISOString();
    save();

    const started = Date.now();
    let lastActivity = started;
    let lastSave = 0;
    let text = "";
    let final = null;
    let other = "";
    let stderr = "";
    let buffer = "";
    let stopReason = null;

    const touch = () => {
      lastActivity = Date.now();
      status.lastActivityAt = new Date(lastActivity).toISOString();
      if (lastActivity - lastSave > 1000) {
        lastSave = lastActivity;
        save();
      }
    };
    const handleLine = (line) => {
      if (line.trim() === "") return;
      fs.appendFileSync(eventsFile, `${line}\n`);
      touch();
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        other = (other + line + "\n").slice(-4000);
        return;
      }
      if (event.event === "init") status.conversationId = event.conversation_id ?? null;
      else if (event.event === "step_update") {
        const step = event.step_update ?? {};
        status.conversationId ??= step.conversation_id ?? null;
        if (step.state === "DONE") status.steps += 1;
        if (step.step_type === "agent_response" && typeof step.text_delta === "string") {
          text += step.text_delta;
        }
      } else if (event.event === "result") final = event.result ?? {};
    };

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handleLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-4000);
      touch();
    });

    const stop = (reason) => {
      if (stopReason) return;
      stopReason = reason;
      killTree(child.pid);
    };
    const timer = setInterval(() => {
      const now = Date.now();
      if (fs.existsSync(path.join(dir, "cancel.flag"))) stop("cancelled");
      else if (now - lastActivity > job.idleSeconds * 1000) stop("idle-timeout");
      else if (now - started > job.hardSeconds * 1000) stop("hard-timeout");
    }, opts.tickMs ?? 2000);

    child.on("error", (e) => {
      clearInterval(timer);
      resolve(finish("error", EXIT.ERROR, `cannot start agy: ${e.message}`));
    });
    child.on("close", (code) => {
      clearInterval(timer);
      if (buffer.trim() !== "") handleLine(buffer);
      const partial = () => fs.writeFileSync(resultFile, text);
      if (stopReason === "cancelled") {
        partial();
        return resolve(finish("cancelled", EXIT.CANCELLED, "cancelled on request"));
      }
      if (stopReason === "idle-timeout" || stopReason === "hard-timeout") {
        partial();
        const idle = stopReason === "idle-timeout";
        return resolve(
          finish(
            stopReason,
            idle ? EXIT.IDLE : EXIT.HARD,
            idle
              ? `no output for ${job.idleSeconds}s; partial text kept, resume with conversation ${status.conversationId}`
              : `exceeded ${job.hardSeconds}s`,
          ),
        );
      }
      if (final?.status === "SUCCESS" && !code) {
        fs.writeFileSync(resultFile, typeof final.response === "string" ? final.response : text);
        return resolve(finish("done", EXIT.OK));
      }
      partial();
      const diagnostics = `${stderr}\n${other}\n${final?.error ?? ""}`;
      if (QUOTA_RE.test(diagnostics)) {
        status.resetSeconds = parseResetSeconds(diagnostics);
        return resolve(finish("quota", EXIT.QUOTA, "agy quota or rate limit hit"));
      }
      const why = final
        ? `agy result status ${final.status}`
        : `agy exited with ${code} and no result`;
      return resolve(finish("error", EXIT.ERROR, `${why}: ${diagnostics.trim().slice(0, 300)}`));
    });
  });
}

/** Reads status.json and adds liveness facts. A "running" job whose worker died is reported dead. */
export function jobStatus(id, root = REPO_ROOT, now = Date.now()) {
  const dir = jobDir(root, id);
  if (!fs.existsSync(path.join(dir, "status.json"))) {
    return { id, state: fs.existsSync(path.join(dir, "job.json")) ? "not-started" : "unknown" };
  }
  const status = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));
  const active = status.state === "starting" || status.state === "running";
  const workerAlive = isAlive(status.workerPid);
  const last = Date.parse(status.lastActivityAt ?? status.startedAt);
  const idleForSeconds = active ? Math.round((now - last) / 1000) : null;
  return {
    ...status,
    workerAlive,
    agyAlive: isAlive(status.agyPid),
    idleForSeconds,
    verdict: !active
      ? "finished"
      : !workerAlive
        ? "dead"
        : idleForSeconds > status.idleSeconds / 2
          ? "stalled"
          : "running",
  };
}

/** Asks the worker to stop; if the worker is gone, kills any orphaned agy process directly. */
export function cancelJob(id, root = REPO_ROOT) {
  const dir = jobDir(root, id);
  const status = jobStatus(id, root);
  if (status.state === "unknown") return status;
  fs.writeFileSync(path.join(dir, "cancel.flag"), "");
  if (!status.workerAlive) {
    killTree(status.agyPid);
    writeJson(path.join(dir, "status.json"), {
      ...status,
      state: "cancelled",
      exitCode: EXIT.CANCELLED,
      detail: "worker was not running; agy process killed",
    });
  }
  return jobStatus(id, root);
}

async function main(argv) {
  const [sub, id] = argv;
  if (!["run", "status", "result", "cancel"].includes(sub ?? "") || !id) {
    process.stderr.write("usage: node scripts/agy-job.mjs <run|status|result|cancel> <job-id>\n");
    return EXIT.USAGE;
  }
  try {
    if (sub === "run") {
      const code = await runJob(id);
      process.stdout.write(`${JSON.stringify(jobStatus(id))}\n`);
      return code;
    }
    if (sub === "status") {
      process.stdout.write(`${JSON.stringify(jobStatus(id), null, 2)}\n`);
      return EXIT.OK;
    }
    if (sub === "cancel") {
      process.stdout.write(`${JSON.stringify(cancelJob(id), null, 2)}\n`);
      return EXIT.OK;
    }
    const file = path.join(jobDir(REPO_ROOT, id), "result.md");
    if (!fs.existsSync(file)) {
      process.stderr.write("no result yet\n");
      return EXIT.ERROR;
    }
    process.stdout.write(fs.readFileSync(file, "utf8"));
    return EXIT.OK;
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    return EXIT.USAGE;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
