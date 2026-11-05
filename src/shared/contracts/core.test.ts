import { describe, expect, it } from "vitest";
import { core, stubCore } from "./index";

describe("contracts core (CL-03)", () => {
  it("uses the real engine for every function, the codec included (contract-v2)", () => {
    for (const key of [
      "evaluate",
      "sortRecipients",
      "findShadowedPatterns",
      "detectFieldRuleConflicts",
      "mergePolicy",
      "diffRings",
      "suggestRing",
      "encodeRing",
      "decodeRing",
    ] as const) {
      expect(core[key]).not.toBe(stubCore[key]);
    }
  });

  it("uses the real field-rule conflict detection", () => {
    expect(core.detectFieldRuleConflicts).not.toBe(stubCore.detectFieldRuleConflicts);
    const rules = [
      { pattern: "p.vn", type: "mustBeIn", field: "cc" },
      { pattern: "x@p.vn", type: "mustNotBeIn", field: "cc" },
    ] as const;
    expect(core.detectFieldRuleConflicts(rules)).toHaveLength(1);
  });

  it("reports shadowed patterns by first-match-wins", () => {
    expect(core.findShadowedPatterns(["*.x.vn", "x.vn"])).toEqual([]);
    expect(core.findShadowedPatterns(["*", "x.vn"])).toEqual([{ shadowed: "x.vn", by: "*" }]);
    expect(core.findShadowedPatterns(["abccorp.vn", "cfo@abccorp.vn"])).toEqual([
      { shadowed: "cfo@abccorp.vn", by: "abccorp.vn" },
    ]);
  });
});
