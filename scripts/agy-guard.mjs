// PreToolUse hook for the Antigravity bridge (CL-11, docs/tasks/CL-11.md).
// Deny by default: a call is allowed only when every directory it exposes to agy is on the
// allow list, the workspace is never the repo root, and unattended edits are not requested.
import path from "node:path";
import { fileURLToPath } from "node:url";

// Directories Antigravity may write to (AGENTS.md section 2, Antigravity-owned).
export const ALLOW_WRITE = [
  "src/taskpane",
  "src/readmode/ui",
  "src/shared/i18n/locales",
  "docs/user",
  "docs/rollout",
  "worker/heartbeat",
];

// Directories sent only as read context for a brief.
export const ALLOW_CONTEXT = ["src/shared/contracts", "docs/tasks", "docs/agents"];

// Explicit deny rows. Checked first so the reason is reported even though default-deny
// would also reject them.
export const DENY = [
  "packages/core",
  "src/launchevent",
  "src/shared/office",
  "src/shared/storage",
  "manifest",
  "build",
  ".github",
  "scripts",
  "spikes",
  "docs/spikes",
  "project_plan.md",
  ".env",
  "node_modules",
  "dist",
  "coverage",
  "reports",
  ".stryker-tmp",
  ".git",
  ".tools",
  ".claude",
  ".mcp.json",
];

// Narrow exception (D-6): advisory, read-only review of a claude/* PR.
export const REVIEW_ONLY = ["packages/core"];
export const REVIEW_MARKER = "[REVIEW]";

// Path-shaped strings that must not appear in a prompt. Plain words such as "build" are left
// out on purpose so ordinary prose is not blocked.
export const PROMPT_DENY = [
  /packages\/core/i,
  /src\/launchevent/i,
  /src\/shared\/(office|storage)/i,
  /docs\/spikes/i,
  /project_plan/i,
  /(^|[\s"'`(/])\.(env|git|gemini|tools|claude|github|stryker-tmp)\b/i,
  /\.mcp\.json/i,
  /(^|[\s"'`(/])(manifest|scripts|spikes|node_modules)\//i,
];

const norm = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

function isWithin(child, parent) {
  return child === parent || child.startsWith(`${parent}/`);
}

/**
 * Resolve a requested directory to a repo-relative, lower-cased, slash-separated path.
 * Returns null when it falls outside the repository.
 */
export function toRepoRelative(dir, repoRoot) {
  const abs = norm(path.resolve(repoRoot, dir));
  const root = norm(path.resolve(repoRoot));
  if (!isWithin(abs, root)) return null;
  return abs === root ? "" : abs.slice(root.length + 1);
}

/**
 * Decide whether a bridge tool call may run.
 * @returns {{ allow: true } | { allow: false, reason: string }}
 */
export function evaluate(toolName, input, repoRoot) {
  const args = input ?? {};
  const deny = (reason) => ({ allow: false, reason });

  if (toolName.endsWith("agy_research")) {
    const q = typeof args.query === "string" ? args.query.replace(/\\/g, "/") : "";
    const hit = PROMPT_DENY.find((re) => re.test(q));
    return hit ? deny(`the query names a denied path (${hit.source})`) : { allow: true };
  }
  if (!toolName.endsWith("agy_ask")) return deny(`unknown bridge tool: ${toolName}`);

  if (args.skip_permissions === true) {
    return deny(
      "skip_permissions is not allowed: agy must not edit files or run commands unattended",
    );
  }

  // T5 finding: agy reads any file named in its prompt, whatever add_dir says. add_dir is not a
  // boundary, so the prompt itself is screened for denied paths. This is a heuristic; the
  // brief writer must also keep denied content out of the prompt.
  const prompt = typeof args.prompt === "string" ? args.prompt.replace(/\\/g, "/") : "";
  const wantsReview = prompt.trimStart().startsWith(REVIEW_MARKER);
  const leak = PROMPT_DENY.find(
    (re) => re.test(prompt) && !(wantsReview && re.source.startsWith("packages")),
  );
  if (leak) return deny(`the prompt names a denied path (${leak.source})`);

  const dirs = Array.isArray(args.add_dir) ? args.add_dir : [];
  if (dirs.some((d) => typeof d !== "string")) return deny("add_dir must be a list of strings");

  if (dirs.length === 0) {
    // With workspace "auto" the bridge falls back to the server's cwd, which is the repo root.
    return args.workspace === "none"
      ? { allow: true }
      : deny('pass add_dir explicitly or workspace "none": the default workspace is the repo root');
  }

  const rel = [];
  for (const d of dirs) {
    const r = toRepoRelative(d, repoRoot);
    if (r === null) return deny(`${d} is outside the repository`);
    if (r === "") return deny("the repository root is never a valid add_dir");
    rel.push(r);
  }

  for (const r of rel) {
    if (REVIEW_ONLY.some((x) => isWithin(r, x))) {
      if (!wantsReview) {
        return deny(
          `${r} is only allowed for a review call whose prompt starts with ${REVIEW_MARKER}`,
        );
      }
      continue;
    }
    const hit = DENY.find((x) => isWithin(r, x) || isWithin(x, r));
    if (hit) return deny(`${r} is denied (${hit})`);
    const allowed = [...ALLOW_WRITE, ...ALLOW_CONTEXT].some((x) => isWithin(r, x));
    if (!allowed) return deny(`${r} is not on the allow list`);
  }

  if (wantsReview && rel.some((r) => ALLOW_WRITE.some((x) => isWithin(r, x)))) {
    return deny("a review call must not include a write-allowed directory");
  }

  return { allow: true };
}

function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      // Fail closed: this hook guards data leaving the machine.
      emit(false, "agy-guard could not parse the hook input");
      return;
    }
    const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
    const result = evaluate(String(event.tool_name ?? ""), event.tool_input, root);
    emit(result.allow, result.allow ? "" : result.reason);
  });
}

function emit(allow, reason) {
  if (allow) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `agy-guard: ${reason}`,
      },
    }),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
