// i18n completeness (AGENTS.md section 6.5):
//  1. every locale catalog defines exactly the same keys;
//  2. each catalog covers the contract key list (src/shared/contracts/i18nKeys.ts).
// Until AG-07 delivers the catalogs, gaps against the key list are warnings (exit 0).
// Set I18N_STRICT=1 to turn them into failures.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "src/shared/i18n/locales";
const KEYS_FILE = "src/shared/contracts/i18nKeys.ts";

/** Reads the quoted keys inside `I18N_KEYS = [ ... ] as const`. */
export function parseKeyList(source) {
  const body = /I18N_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source)?.[1] ?? "";
  return [...body.matchAll(/^\s*"([^"]+)",?\s*$/gm)].map((m) => m[1]);
}

export function diffKeys(catalogs) {
  const all = new Set(Object.values(catalogs).flatMap((c) => Object.keys(c)));
  const problems = [];
  for (const [locale, cat] of Object.entries(catalogs)) {
    for (const key of all) if (!(key in cat)) problems.push(`${locale}: missing key "${key}"`);
  }
  return problems;
}

export function diffAgainstList(catalogs, keys) {
  const problems = [];
  for (const [locale, cat] of Object.entries(catalogs)) {
    for (const key of keys) if (!(key in cat)) problems.push(`${locale}: not translated "${key}"`);
    for (const key of Object.keys(cat)) {
      if (!keys.includes(key)) problems.push(`${locale}: unknown key "${key}"`);
    }
  }
  return problems;
}

function main() {
  const keys = existsSync(KEYS_FILE) ? parseKeyList(readFileSync(KEYS_FILE, "utf8")) : [];
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];
  if (files.length === 0) {
    console.log(
      `i18n-check: ${keys.length} contract keys, no catalogs yet (AG-07 delivers vi/en).`,
    );
    return;
  }
  const catalogs = Object.fromEntries(
    files.map((f) => [f, JSON.parse(readFileSync(join(DIR, f), "utf8"))]),
  );
  const inconsistent = diffKeys(catalogs);
  if (inconsistent.length > 0) {
    console.error(inconsistent.join("\n"));
    process.exit(1);
  }
  const gaps = diffAgainstList(catalogs, keys);
  if (gaps.length > 0) {
    const strict = process.env.I18N_STRICT === "1";
    (strict ? console.error : console.warn)(gaps.join("\n"));
    if (strict) process.exit(1);
    console.warn(`i18n-check: ${gaps.length} gaps against the contract key list (warning).`);
    return;
  }
  console.log(`i18n-check: OK (${files.length} catalogs, ${keys.length} keys)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
