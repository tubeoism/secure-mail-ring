import { describe, expect, it } from "vitest";
import { violations } from "./path-guard.mjs";
import { diffKeys } from "./i18n-check.mjs";

describe("path guard", () => {
  it("flags lead-owned paths and passes owned ones", () => {
    expect(violations(["src/taskpane/App.tsx", "docs/user/guide.md"])).toEqual([]);
    expect(violations(["packages/core/src/x.ts", "manifest/m.xml", "package.json"])).toHaveLength(
      3,
    );
  });
});

describe("i18n check", () => {
  it("reports keys missing from a locale", () => {
    expect(diffKeys({ vi: { a: "1", b: "2" }, en: { a: "1" } })).toEqual(['en: missing key "b"']);
    expect(diffKeys({ vi: { a: "1" }, en: { a: "1" } })).toEqual([]);
  });
});
