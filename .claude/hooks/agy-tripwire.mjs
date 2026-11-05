// Fail-closed tripwire for Antigravity (agent toolkit). A repository registers it as a PreToolUse
// hook in `.claude/settings.json` (see the toolkit block in CLAUDE.md). It needs no plugin and no
// policy, so it also works where the `agy-bridge` plugin is not installed (a fresh machine, a cloud
// session): starting `agy` directly from a shell, or calling the old Antigravity MCP tools, is
// refused. The only shell commands let through are the plugin's job runner and read-only queries.
// The plugin's own guard repeats this check and adds the per-project policy. It is a heuristic
// against accidents and injected commands, not a sandbox.
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUNNER_PATH = String.raw`(?:"[^"]*[\\/]agy-job\.mjs"|'[^']*[\\/]agy-job\.mjs'|(?:[^\s"']*[\\/])?agy-job\.mjs)`;
const JOB_RUNNER = new RegExp(
  String.raw`^\s*node\s+${RUNNER_PATH}\s+(?:run|status|result|cancel)\s+[a-z0-9][a-z0-9-]{1,38}[a-z0-9]\s*$`,
  "i",
);
const AGY_READ_ONLY =
  /^\s*agy(?:\.exe)?\s+(?:--version|--help|models|changelog|help(?:\s+[a-z][a-z-]*)?)\s*$/i;
const AGY_COMMAND_WORD =
  /(?:^|[;&|(\n]|\bStart-Process)\s*(?:-FilePath\s+)?["']?(?:[^\s;&|()"']*[\\/])?(?:agy|agy-bridge|agy-mcp-server)(?:\.exe)?["']?(?=\s|$|[;&|)])/i;
const AGY_PYTHON_MODULE = /\b(?:python|py)(?:\.exe)?\b[^\n]*\bagy_(?:headless_bridge|mcp_server)/i;
const MCP_PREFIX = "mcp__antigravity__";

/** @returns {{ allow: true } | { allow: false, reason: string }} */
export function check(toolName, input) {
  if (toolName.startsWith(MCP_PREFIX)) {
    return {
      allow: false,
      reason:
        "the Antigravity MCP tools run agy without plan mode and can write anywhere on disk; install the agy-bridge plugin and start jobs with its runner",
    };
  }
  if (toolName !== "Bash" && toolName !== "PowerShell") return { allow: true };
  const command = typeof input?.command === "string" ? input.command : "";
  if (JOB_RUNNER.test(command) || AGY_READ_ONLY.test(command)) return { allow: true };
  if (AGY_COMMAND_WORD.test(command) || AGY_PYTHON_MODULE.test(command)) {
    return {
      allow: false,
      reason:
        "agy must be started through the agy-bridge plugin's job runner (`node <plugin>/scripts/agy-job.mjs run <job-id>`); if the plugin is not installed, install it first",
    };
  }
  return { allow: true };
}

function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    let result;
    try {
      const event = JSON.parse(raw);
      result = check(String(event.tool_name ?? ""), event.tool_input);
    } catch {
      // Fail closed: this hook guards data leaving the machine.
      result = { allow: false, reason: "agy-tripwire could not parse the hook input" };
    }
    if (result.allow) return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `agy-tripwire: ${result.reason}`,
        },
      }),
    );
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
