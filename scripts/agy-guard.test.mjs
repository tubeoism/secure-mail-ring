import { describe, expect, it } from "vitest";
import path from "node:path";
import { evaluate, toRepoRelative } from "./agy-guard.mjs";

const ROOT = path.resolve("repo-root");
const ask = (input) => evaluate("mcp__antigravity__agy_ask", input, ROOT);
const allowed = (input) => expect(ask(input)).toEqual({ allow: true });
const denied = (input, fragment) => {
  const r = ask(input);
  expect(r.allow).toBe(false);
  expect(r.reason).toContain(fragment);
};

describe("agy-guard: workspace", () => {
  it("allows research with no workspace", () => {
    expect(evaluate("mcp__antigravity__agy_research", { query: "x" }, ROOT).allow).toBe(true);
    allowed({ prompt: "p", workspace: "none" });
  });

  it("denies the implicit repo-root workspace", () => {
    denied({ prompt: "p" }, "repo root");
    denied({ prompt: "p", workspace: "auto" }, "repo root");
    denied({ prompt: "p", add_dir: [] }, "repo root");
  });

  it("denies the repo root and anything outside it", () => {
    denied({ prompt: "p", add_dir: ["."] }, "repository root");
    denied({ prompt: "p", add_dir: [ROOT] }, "repository root");
    denied({ prompt: "p", add_dir: ["../elsewhere"] }, "outside");
    denied({ prompt: "p", add_dir: ["src/taskpane/../../.."] }, "outside");
    denied({ prompt: "p", add_dir: [path.resolve(ROOT, "..", ".gemini")] }, "outside");
  });

  it("denies unknown tools and non-string directories", () => {
    expect(evaluate("mcp__antigravity__other", {}, ROOT).allow).toBe(false);
    denied({ prompt: "p", add_dir: [42] }, "list of strings");
  });
});

describe("agy-guard: allow and deny lists", () => {
  it("allows Antigravity-owned and context directories", () => {
    allowed({ prompt: "p", add_dir: ["src/taskpane"] });
    allowed({ prompt: "p", add_dir: ["src/taskpane/screens", "src/shared/contracts"] });
    allowed({ prompt: "p", add_dir: [path.join(ROOT, "docs", "user")] });
    allowed({ prompt: "p", add_dir: ["docs\\tasks"] });
  });

  it("denies lead-owned and sensitive directories", () => {
    for (const d of [
      "src/launchevent",
      "src/shared/office",
      "src/shared/storage",
      "manifest",
      "build",
      ".github",
      "scripts",
      "spikes",
      "docs/spikes",
      "node_modules",
      ".git",
      ".tools",
      ".claude",
    ]) {
      denied({ prompt: "p", add_dir: [d] }, "denied");
    }
  });

  it("denies a parent of a denied directory and anything unlisted", () => {
    denied({ prompt: "p", add_dir: ["docs"] }, "denied");
    denied({ prompt: "p", add_dir: ["src"] }, "denied");
    denied({ prompt: "p", add_dir: ["src/shared"] }, "denied");
    denied({ prompt: "p", add_dir: ["some/other"] }, "not on the allow list");
  });

  it("is case-insensitive and slash-insensitive", () => {
    denied({ prompt: "p", add_dir: ["SRC\\LaunchEvent"] }, "denied");
    allowed({ prompt: "p", add_dir: ["SRC/TaskPane/"] });
  });

  it("denies one bad directory among good ones", () => {
    denied({ prompt: "p", add_dir: ["src/taskpane", "manifest"] }, "denied");
  });
});

describe("agy-guard: unattended edits", () => {
  it("denies skip_permissions", () => {
    denied({ prompt: "p", add_dir: ["src/taskpane"], skip_permissions: true }, "skip_permissions");
  });
});

describe("agy-guard: core review exception (D-6)", () => {
  it("allows packages/core only for a [REVIEW] call", () => {
    allowed({ prompt: "[REVIEW] read-only, advisory", add_dir: ["packages/core"] });
    allowed({
      prompt: "  [REVIEW] note",
      add_dir: ["packages/core/src", "src/shared/contracts"],
    });
    denied({ prompt: "implement x", add_dir: ["packages/core"] }, "[REVIEW]");
    denied({ add_dir: ["packages/core"] }, "[REVIEW]");
  });

  it("rejects a review call that includes a write-allowed directory", () => {
    denied({ prompt: "[REVIEW] x", add_dir: ["packages/core", "src/taskpane"] }, "write-allowed");
  });

  it("keeps other deny rows closed during a review", () => {
    denied({ prompt: "[REVIEW] x", add_dir: ["packages/core", "src/launchevent"] }, "denied");
    denied({ prompt: "[REVIEW] x", add_dir: ["packages/core"], skip_permissions: true }, "skip");
  });
});

describe("agy-guard: prompt screening (T5 finding)", () => {
  it("denies a prompt that names a denied path, even with a valid add_dir", () => {
    for (const p of [
      "read project_plan.md and summarise",
      "open C:\\repo\\packages\\core\\src\\x.ts",
      "cat ~/.gemini/antigravity-cli/token",
      "see manifest/manifest.template.xml",
      "check .env.local",
      "look at src/launchevent/handler.ts",
    ]) {
      denied({ prompt: p, add_dir: ["src/taskpane"] }, "denied path");
      denied({ prompt: p, workspace: "none" }, "denied path");
    }
  });

  it("does not block ordinary prose", () => {
    allowed({
      prompt: "Build the ring list screen; run the scripts you need to render states.",
      add_dir: ["src/taskpane"],
    });
  });

  it("lets a [REVIEW] prompt mention packages/core only", () => {
    allowed({ prompt: "[REVIEW] review packages/core/src/x.ts", add_dir: ["packages/core"] });
    denied(
      { prompt: "[REVIEW] also read manifest/x.xml", add_dir: ["packages/core"] },
      "denied path",
    );
  });
});

describe("agy-guard: shell route", () => {
  const shell = (command, tool = "Bash") => evaluate(tool, { command }, ROOT);

  it("allows the job runner commands for a valid job id", () => {
    for (const c of [
      "node scripts/agy-job.mjs run review-pr9-a",
      "node ./scripts/agy-job.mjs status review-pr9-a",
      "node scripts/agy-job.mjs result abc",
      "node scripts/agy-job.mjs cancel abc",
    ]) {
      expect(shell(c).allow).toBe(true);
      expect(shell(c, "PowerShell").allow).toBe(true);
    }
  });

  it("allows read-only agy queries and unrelated commands that only mention agy", () => {
    for (const c of [
      "agy --version",
      "agy models",
      "ls .tools/agy-bridge/venv",
      "git log -- docs/agents/delegation-log.md",
      "npm run verify",
      "grep -n agy CLAUDE.md",
      "cat scripts/agy-guard.mjs",
    ]) {
      expect(shell(c).allow, c).toBe(true);
    }
  });

  it("denies starting agy or the bridge directly", () => {
    for (const c of [
      'agy -p "hello"',
      "agy --dangerously-skip-permissions -p x",
      "cd /tmp && agy -p x",
      "echo hi | agy",
      "(agy -p x)",
      "./.tools/agy-bridge/venv/Scripts/agy-bridge.exe --no-workspace hi",
      "C:\\tools\\agy.exe -p x",
      '"agy" -p x',
      "agy-mcp-server",
      "python -m agy_headless_bridge hi",
      "py -3.11 -c 'from agy_headless_bridge import bridge; bridge.run(\"x\")'",
      "node scripts/agy-job.mjs run abc && agy -p x",
    ]) {
      expect(shell(c).allow, c).toBe(false);
    }
    expect(shell("& agy -p x", "PowerShell").allow).toBe(false);
    expect(shell("Start-Process agy -ArgumentList '-p x'", "PowerShell").allow).toBe(false);
    expect(shell('Start-Process -FilePath "agy.exe"', "PowerShell").allow).toBe(false);
  });

  it("tolerates a missing command", () => {
    expect(evaluate("Bash", {}, ROOT).allow).toBe(true);
    expect(evaluate("Bash", undefined, ROOT).allow).toBe(true);
  });
});

describe("toRepoRelative", () => {
  it("normalises paths", () => {
    expect(toRepoRelative("Src\\TaskPane\\", ROOT)).toBe("src/taskpane");
    expect(toRepoRelative(".", ROOT)).toBe("");
    expect(toRepoRelative("..", ROOT)).toBeNull();
  });
});
