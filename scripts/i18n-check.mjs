// i18n completeness (AGENTS.md section 6.5):
//  1. every locale catalog defines exactly the same keys;
//  2. each catalog covers the contract key list (src/shared/contracts/i18nKeys.ts);
//  3. for each key, every locale uses the same `{placeholders}`, and only the ones the contract
//     allows for that key (AG-07 card; the finding texts take the parameters of CL-05 D4, every
//     other key takes none).
// Until AG-07 delivers the catalogs, gaps against the key list are warnings (exit 0).
// Set I18N_STRICT=1 to turn them into failures. Placeholder problems always fail.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path, { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = "src/shared/i18n/locales";
const KEYS_FILE = "src/shared/contracts/i18nKeys.ts";

/** Parameters that `t(key, params)` receives, per key (CL-05 D4). Keys not listed take none. */
export const ALLOWED_PLACEHOLDERS = {
  "finding.outsider": ["address", "field"],
  "finding.missingToken": ["file"],
  "finding.foreignRingToken": ["file", "ring"],
  "finding.lookalike": ["address", "similarTo", "ring"],
  "finding.firstTime": ["address"],
  "finding.fieldRule.mustBeIn": ["address", "pattern", "field", "foundIn"],
  "finding.fieldRule.mustNotBeIn": ["address", "field"],
  "finding.fieldRule.onlyIn": ["address", "field", "foundIn"],
};

/** The sorted, distinct `{name}` placeholders of a text, as the translator reads them. */
export function placeholders(text) {
  return [...new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

/** Problems with placeholders: a locale that differs from another, or a name the key does not allow. */
export function diffPlaceholders(catalogs, allowed = ALLOWED_PLACEHOLDERS) {
  const problems = [];
  const locales = Object.keys(catalogs);
  const keys = new Set(locales.flatMap((l) => Object.keys(catalogs[l])));
  for (const key of keys) {
    const sets = locales
      .filter((l) => key in catalogs[l])
      .map((l) => [l, placeholders(catalogs[l][key])]);
    const [firstLocale, first] = sets[0];
    for (const [locale, set] of sets.slice(1)) {
      if (set.join(",") !== first.join(",")) {
        problems.push(
          `${key}: placeholders differ (${firstLocale}: {${first.join(", ")}}, ${locale}: {${set.join(", ")}})`,
        );
      }
    }
    const ok = new Set(allowed[key] ?? []);
    for (const [locale, set] of sets) {
      for (const name of set) {
        if (!ok.has(name))
          problems.push(`${locale}: "${key}" uses {${name}}, which the contract does not give it`);
      }
    }
  }
  return problems;
}

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
  const placeholderProblems = diffPlaceholders(catalogs);
  if (placeholderProblems.length > 0) {
    console.error(placeholderProblems.join("\n"));
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

// Compare as paths: `file://${argv[1]}` never matches on Windows, so the check silently did nothing there.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
