import { describe, expect, it } from "vitest";
import { violations } from "./path-guard.mjs";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ALLOWED_PLACEHOLDERS,
  diffAgainstList,
  diffKeys,
  diffPlaceholders,
  parseKeyList,
  placeholders,
} from "./i18n-check.mjs";
import { I18N_KEYS } from "../src/shared/contracts/i18nKeys";

describe("path guard", () => {
  it("flags lead-owned paths and passes owned ones", () => {
    expect(violations(["src/taskpane/App.tsx", "docs/user/guide.md"])).toEqual([]);
    expect(violations(["packages/core/src/x.ts", "manifest/m.xml", "package.json"])).toHaveLength(
      3,
    );
  });

  it("treats the Antigravity bridge configuration as lead-owned (CL-11)", () => {
    expect(
      violations([
        ".mcp.json",
        ".claude/settings.json",
        ".claude/agents/a.md",
        "scripts/agy-guard.mjs",
      ]),
    ).toHaveLength(4);
  });
});

describe("i18n check", () => {
  it("reports keys missing from a locale", () => {
    expect(diffKeys({ vi: { a: "1", b: "2" }, en: { a: "1" } })).toEqual(['en: missing key "b"']);
    expect(diffKeys({ vi: { a: "1" }, en: { a: "1" } })).toEqual([]);
  });
});

describe("i18n placeholders (AG-07)", () => {
  it("reads distinct sorted names the way the translator does", () => {
    expect(placeholders("{b} and {a}, again {b}; {not closed and {1}")).toEqual(["1", "a", "b"]);
    expect(placeholders("no values")).toEqual([]);
    expect(placeholders("{}  { a }  {a-b}")).toEqual([]);
  });

  it("reports a locale whose placeholders differ", () => {
    const catalogs = {
      vi: { "finding.firstTime": "Lần đầu: {address}" },
      en: { "finding.firstTime": "First time: {address} {file}" },
    };
    const problems = diffPlaceholders(catalogs);
    expect(problems.some((p) => p.includes("placeholders differ"))).toBe(true);
    expect(problems.some((p) => p.includes('en: "finding.firstTime" uses {file}'))).toBe(true);
  });

  it("accepts the allowed names in any order, and none for a key without parameters", () => {
    expect(
      diffPlaceholders({
        vi: { "finding.lookalike": "{similarTo} ~ {address}{ring}", "common.save": "Lưu" },
        en: { "finding.lookalike": "{address} ~ {similarTo}{ring}", "common.save": "Save" },
      }),
    ).toEqual([]);
  });

  it("refuses a placeholder on a key that takes none", () => {
    const problems = diffPlaceholders({
      vi: { "common.save": "Lưu {x}" },
      en: { "common.save": "Save {x}" },
    });
    expect(problems).toEqual([
      'vi: "common.save" uses {x}, which the contract does not give it',
      'en: "common.save" uses {x}, which the contract does not give it',
    ]);
  });

  it("only lists keys that exist in the contract", () => {
    for (const key of Object.keys(ALLOWED_PLACEHOLDERS)) expect(I18N_KEYS).toContain(key);
  });
});

describe("i18n check as a command", () => {
  const script = path.resolve("scripts/i18n-check.mjs");
  const run = (locales) => {
    const dir = mkdtempSync(path.join(tmpdir(), "i18n-"));
    try {
      mkdirSync(path.join(dir, "src/shared/contracts"), { recursive: true });
      mkdirSync(path.join(dir, "src/shared/i18n/locales"), { recursive: true });
      writeFileSync(
        path.join(dir, "src/shared/contracts/i18nKeys.ts"),
        'export const I18N_KEYS = [\n  "common.save",\n  "finding.firstTime",\n] as const;\n',
      );
      for (const [name, body] of Object.entries(locales)) {
        writeFileSync(path.join(dir, "src/shared/i18n/locales", name), JSON.stringify(body));
      }
      return spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("actually runs when started from the command line (also on Windows)", () => {
    const r = run({});
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("2 contract keys, no catalogs yet");
  });

  it("passes complete catalogs with matching placeholders", () => {
    const r = run({
      "vi.json": { "common.save": "Lưu", "finding.firstTime": "Lần đầu: {address}" },
      "en.json": { "common.save": "Save", "finding.firstTime": "First time: {address}" },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("OK (2 catalogs, 2 keys)");
  });

  it("fails on a placeholder mismatch even without strict mode", () => {
    const r = run({
      "vi.json": { "common.save": "Lưu", "finding.firstTime": "Lần đầu" },
      "en.json": { "common.save": "Save", "finding.firstTime": "First time: {address}" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("placeholders differ");
  });
});

describe("i18n key list", () => {
  it("parses exactly the keys exported by the TypeScript file", () => {
    const parsed = parseKeyList(readFileSync("src/shared/contracts/i18nKeys.ts", "utf8"));
    expect(parsed).toEqual([...I18N_KEYS]);
  });

  it("reports untranslated and unknown keys against the list", () => {
    expect(diffAgainstList({ vi: { a: "1", z: "2" } }, ["a", "b"])).toEqual([
      'vi: not translated "b"',
      'vi: unknown key "z"',
    ]);
  });
});
