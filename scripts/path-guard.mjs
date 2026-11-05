// CI path guard (AGENTS.md section 2): a PR from an ag/* branch must not touch lead-owned paths.
import { execFileSync } from "node:child_process";

export const LEAD_OWNED = [
  /^packages\/core\//,
  /^src\/launchevent\//,
  /^src\/shared\/(contracts|office|storage)\//,
  /^manifest\//,
  /^build\//,
  /^\.github\//,
  /^(package\.json|package-lock\.json|tsconfig[^/]*|webpack[^/]*|eslint[^/]*|vitest[^/]*)$/,
  /^(AGENTS\.md|CLAUDE\.md|project_plan\.md)$/,
  /^\.agents\//,
  /^docs\/agents\//,
  /^\.claude\//,
  /^\.mcp\.json$/,
  /^scripts\//,
];

export function violations(files) {
  return files.filter((f) => LEAD_OWNED.some((re) => re.test(f)));
}

function main() {
  const branch = process.env.GITHUB_HEAD_REF || process.env.BRANCH_NAME || "";
  if (!branch.startsWith("ag/")) {
    console.log(`path-guard: branch "${branch || "(local)"}" is not ag/*, skipped.`);
    return;
  }
  const base = process.env.BASE_REF || "origin/main";
  const out = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
  const bad = violations(out.split("\n").filter(Boolean));
  if (bad.length > 0) {
    console.error("path-guard: lead-owned paths touched:\n" + bad.map((f) => `  ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("path-guard: OK");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
