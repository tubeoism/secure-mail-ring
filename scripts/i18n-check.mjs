// i18n completeness (AGENTS.md section 6.5): every locale must define exactly the same keys.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "src/shared/i18n/locales";

export function diffKeys(catalogs) {
  const all = new Set(Object.values(catalogs).flatMap((c) => Object.keys(c)));
  const problems = [];
  for (const [locale, cat] of Object.entries(catalogs)) {
    for (const key of all) if (!(key in cat)) problems.push(`${locale}: missing key "${key}"`);
  }
  return problems;
}

function main() {
  if (!existsSync(DIR)) return console.log("i18n-check: no locales dir, skipped.");
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0)
    return console.log("i18n-check: no catalogs yet (arrive with CL-02/AG-07).");
  const catalogs = Object.fromEntries(
    files.map((f) => [f, JSON.parse(readFileSync(join(DIR, f), "utf8"))]),
  );
  const problems = diffKeys(catalogs);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`i18n-check: OK (${files.length} catalogs)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
