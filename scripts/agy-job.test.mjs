import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers";
import {
  CONSTRAINT,
  EXIT,
  cancelJob,
  isAlive,
  jobDir,
  jobStatus,
  parseResetSeconds,
  runJob,
} from "./agy-job.mjs";

// A stand-in for agy that speaks the stream-json format, chosen by FAKE_MODE.
const FAKE_AGY = `
const mode = process.env.FAKE_MODE;
const say = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
const step = (state, text_delta) =>
  say({ event: "step_update", step_update: { conversation_id: "c-1", step_index: 1, state, step_type: "agent_response", text_delta } });
if (process.env.FAKE_ARGV_FILE) require("node:fs").writeFileSync(process.env.FAKE_ARGV_FILE, JSON.stringify(process.argv.slice(2)));
if (mode === "silent") setTimeout(() => {}, 60000);
else if (mode === "quota") { process.stderr.write("429 quota exceeded, resets in 2 hours and 5 minutes\\n"); process.exit(1); }
else if (mode === "crash") { process.stderr.write("boom\\n"); process.exit(3); }
else {
  say({ event: "init", conversation_id: "c-1", init: { cwd: process.cwd() } });
  if (mode === "stall") { step("ACTIVE", "partial"); setTimeout(() => {}, 60000); }
  else if (mode === "steady" || mode === "forever") {
    let n = 0;
    const t = setInterval(() => {
      step("ACTIVE", "x");
      n += 1;
      if (mode === "steady" && n === 10) {
        clearInterval(t);
        say({ event: "result", result: { conversation_id: "c-1", status: "SUCCESS", response: "steady done" } });
      }
    }, 200);
  } else if (mode === "failed") {
    say({ event: "result", result: { status: "ERROR", error: "model refused" } });
  } else {
    step("ACTIVE", "Hel"); step("DONE", "lo");
    say({ event: "result", result: { conversation_id: "c-1", status: "SUCCESS", response: "Hello" } });
  }
}
`;

let root;
let fakePath;
const agy = () => ({ command: process.execPath, prefixArgs: [fakePath] });

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-job-test-"));
  fakePath = path.join(root, "fake-agy.cjs");
  fs.writeFileSync(fakePath, FAKE_AGY);
  fs.mkdirSync(path.join(root, "src", "taskpane"), { recursive: true });
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

let counter = 0;
function makeJob(job) {
  const id = `job-${(counter += 1)}`;
  const dir = jobDir(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
  return { id, dir };
}
const run = (id, mode, extra = {}) =>
  runJob(id, {
    root,
    agy: agy(),
    tickMs: 100,
    env: { FAKE_MODE: mode, ...extra },
  });
const readStatus = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));

describe("agy-job: normal run", () => {
  it("returns the result and records events and status", async () => {
    const argvFile = path.join(root, "argv-ok.json");
    const { id, dir } = makeJob({ prompt: "say hello", workspace: "none" });
    expect(await run(id, "ok", { FAKE_ARGV_FILE: argvFile })).toBe(EXIT.OK);

    expect(fs.readFileSync(path.join(dir, "result.md"), "utf8")).toBe("Hello");
    const status = readStatus(dir);
    expect(status).toMatchObject({ state: "done", exitCode: 0, steps: 1, conversationId: "c-1" });
    expect(
      fs.readFileSync(path.join(dir, "events.ndjson"), "utf8").trim().split("\n"),
    ).toHaveLength(4);

    const args = JSON.parse(fs.readFileSync(argvFile, "utf8"));
    expect(args.slice(0, 2)).toEqual(["--output-format", "stream-json"]);
    expect(args[args.indexOf("--mode") + 1]).toBe("plan");
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(args.at(-2)).toBe("-p");
    expect(args.at(-1)).toBe(`say hello${CONSTRAINT}`);
  });

  it("never uses the repo root as cwd: scratch directory without a workspace", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none" });
    await run(id, "ok");
    const init = JSON.parse(
      fs.readFileSync(path.join(dir, "events.ndjson"), "utf8").split("\n")[0],
    );
    expect(fs.realpathSync(init.init.cwd)).toBe(fs.realpathSync(path.join(dir, "cwd")));
  });

  it("uses the first added directory as cwd and passes every --add-dir", async () => {
    const argvFile = path.join(root, "argv-dir.json");
    const { id, dir } = makeJob({ prompt: "p", add_dir: ["src/taskpane"] });
    expect(await run(id, "ok", { FAKE_ARGV_FILE: argvFile })).toBe(EXIT.OK);
    const init = JSON.parse(
      fs.readFileSync(path.join(dir, "events.ndjson"), "utf8").split("\n")[0],
    );
    expect(fs.realpathSync(init.init.cwd)).toBe(
      fs.realpathSync(path.join(root, "src", "taskpane")),
    );
    const args = JSON.parse(fs.readFileSync(argvFile, "utf8"));
    expect(args[args.indexOf("--add-dir") + 1]).toBe(path.resolve(root, "src/taskpane"));
  });

  it("survives past the idle limit while events keep arriving", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none", idleSeconds: 1 });
    expect(await run(id, "steady")).toBe(EXIT.OK);
    expect(fs.readFileSync(path.join(dir, "result.md"), "utf8")).toBe("steady done");
  }, 20_000);
});

describe("agy-job: liveness and failures", () => {
  it("kills a silent run after the idle limit and keeps the partial text", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none", idleSeconds: 1 });
    const started = Date.now();
    expect(await run(id, "stall")).toBe(EXIT.IDLE);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(fs.readFileSync(path.join(dir, "result.md"), "utf8")).toBe("partial");
    const status = readStatus(dir);
    expect(status.state).toBe("idle-timeout");
    expect(status.detail).toContain("resume with conversation c-1");
    expect(isAlive(status.agyPid)).toBe(false);
  }, 20_000);

  it("kills a run that never emits anything", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none", idleSeconds: 1 });
    expect(await run(id, "silent")).toBe(EXIT.IDLE);
    expect(fs.readFileSync(path.join(dir, "result.md"), "utf8")).toBe("");
  }, 20_000);

  it("enforces the hard limit even when events keep arriving", async () => {
    const { id, dir } = makeJob({
      prompt: "p",
      workspace: "none",
      idleSeconds: 30,
      hardSeconds: 5,
    });
    expect(await run(id, "forever")).toBe(EXIT.HARD);
    expect(readStatus(dir).state).toBe("hard-timeout");
  }, 20_000);

  it("reports a quota failure with the reset time", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none" });
    expect(await run(id, "quota")).toBe(EXIT.QUOTA);
    expect(readStatus(dir)).toMatchObject({ state: "quota", resetSeconds: 7500 });
  });

  it("reports a crash without a result as an error with the diagnostics", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none" });
    expect(await run(id, "crash")).toBe(EXIT.ERROR);
    const status = readStatus(dir);
    expect(status.state).toBe("error");
    expect(status.detail).toContain("exited with 3");
    expect(status.detail).toContain("boom");
  });

  it("reports a non-success result as an error", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none" });
    expect(await run(id, "failed")).toBe(EXIT.ERROR);
    expect(readStatus(dir).detail).toContain("model refused");
  });

  it("reports a missing agy binary as an error", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none" });
    const code = await runJob(id, { root, agy: { command: path.join(root, "no-such-agy") } });
    expect(code).toBe(EXIT.ERROR);
    expect(readStatus(dir).state).toBe("error");
  });

  it("stops on request through the cancel flag", async () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none", idleSeconds: 60 });
    const running = run(id, "stall");
    await new Promise((r) => setTimeout(r, 800));
    expect(jobStatus(id, root).verdict).toBe("running");
    cancelJob(id, root);
    expect(await running).toBe(EXIT.CANCELLED);
    expect(readStatus(dir).state).toBe("cancelled");
  }, 20_000);
});

describe("agy-job: guard and input checks", () => {
  it("applies the allow/deny lists before starting agy", async () => {
    for (const job of [
      { prompt: "p", add_dir: ["packages/core"] },
      { prompt: "p", add_dir: ["scripts"] },
      { prompt: "p", add_dir: ["."] },
      { prompt: "p" },
      { prompt: "read project_plan.md", workspace: "none" },
    ]) {
      const argvFile = path.join(root, "argv-denied.json");
      fs.rmSync(argvFile, { force: true });
      const { id, dir } = makeJob(job);
      expect(await run(id, "ok", { FAKE_ARGV_FILE: argvFile })).toBe(EXIT.DENIED);
      expect(readStatus(dir).state).toBe("denied");
      expect(fs.existsSync(argvFile)).toBe(false);
    }
  });

  it("accepts the core review exception only with the marker and no write directory", async () => {
    fs.mkdirSync(path.join(root, "packages", "core"), { recursive: true });
    const ok = makeJob({ prompt: "[REVIEW] read-only", add_dir: ["packages/core"] });
    expect(await run(ok.id, "ok")).toBe(EXIT.OK);
    const mixed = makeJob({
      prompt: "[REVIEW] read-only",
      add_dir: ["packages/core", "src/taskpane"],
    });
    expect(await run(mixed.id, "ok")).toBe(EXIT.DENIED);
  });

  it("rejects an unreadable, empty or oversize job", async () => {
    const missing = jobDir(root, "job-missing");
    fs.mkdirSync(missing, { recursive: true });
    expect(await runJob("job-missing", { root, agy: agy() })).toBe(EXIT.ERROR);
    for (const prompt of ["   ", "x".repeat(24_001)]) {
      const { id } = makeJob({ prompt, workspace: "none" });
      expect(await run(id, "ok")).toBe(EXIT.ERROR);
    }
  });

  it("rejects job ids that could escape the jobs directory", () => {
    for (const bad of ["../x", "a/b", "A_B", "ab", "-abc", "x".repeat(41), ""]) {
      expect(() => jobDir(root, bad)).toThrow();
    }
  });
});

describe("agy-job: status", () => {
  it("reports a running job whose worker has died as dead", () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none" });
    fs.writeFileSync(
      path.join(dir, "status.json"),
      JSON.stringify({
        id,
        state: "running",
        workerPid: 2_000_000_000,
        agyPid: 2_000_000_000,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        idleSeconds: 60,
      }),
    );
    expect(jobStatus(id, root)).toMatchObject({ verdict: "dead", workerAlive: false });
  });

  it("flags a quiet job as stalled before the idle limit fires", () => {
    const { id, dir } = makeJob({ prompt: "p", workspace: "none" });
    const last = Date.now() - 40_000;
    fs.writeFileSync(
      path.join(dir, "status.json"),
      JSON.stringify({
        id,
        state: "running",
        workerPid: process.pid,
        agyPid: null,
        startedAt: new Date(last).toISOString(),
        lastActivityAt: new Date(last).toISOString(),
        idleSeconds: 60,
      }),
    );
    expect(jobStatus(id, root, last + 10_000).verdict).toBe("running");
    expect(jobStatus(id, root, last + 40_000)).toMatchObject({
      verdict: "stalled",
      idleForSeconds: 40,
    });
  });

  it("describes unknown and not-yet-started jobs", () => {
    expect(jobStatus("job-nope", root).state).toBe("unknown");
    const { id } = makeJob({ prompt: "p", workspace: "none" });
    expect(jobStatus(id, root).state).toBe("not-started");
  });
});

describe("parseResetSeconds", () => {
  it("reads durations from prose", () => {
    expect(parseResetSeconds("resets in 4 hours and 50 minutes")).toBe(4 * 3600 + 50 * 60);
    expect(parseResetSeconds("retry after ~28 mins")).toBe(28 * 60);
    expect(parseResetSeconds("in 30s")).toBe(30);
    expect(parseResetSeconds("no duration here")).toBeNull();
  });
});
