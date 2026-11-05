import { describe, expect, it } from "vitest";
import { violations } from "./path-guard.mjs";
import { readFileSync } from "node:fs";
import { diffAgainstList, diffKeys, parseKeyList } from "./i18n-check.mjs";
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
