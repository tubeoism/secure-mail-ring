import { describe, expect, it } from "vitest";
import { detectFieldRuleConflicts, evaluateFieldRules } from "../src/fieldRules";
import type { FieldName, FieldRule, RecipientEntry } from "../src/model";

const e = (address: string): RecipientEntry => ({ address, displayName: "", resolved: true });
const rule = (
  type: FieldRule["type"],
  field: FieldName,
  pattern: string,
  when?: "anyExternal",
): FieldRule => (when ? { pattern, type, field, when } : { pattern, type, field });
const snap = (
  over: Partial<Record<"to" | "cc" | "bcc", string[]>> = {},
  from = "me@auditfirm.vn",
) => ({
  from,
  to: (over.to ?? []).map(e),
  cc: (over.cc ?? []).map(e),
  bcc: (over.bcc ?? []).map(e),
});
const view = (violations: ReturnType<typeof evaluateFieldRules>) =>
  violations.map((v) => [v.ruleIndex, v.kind, v.entry?.address, v.foundIn]);

describe("evaluateFieldRules: mustBeIn", () => {
  const rules = [rule("mustBeIn", "cc", "partner.vn")];
  it("passes when a match is in the field", () => {
    expect(evaluateFieldRules(rules, snap({ cc: ["p@partner.vn"] }))).toEqual([]);
    expect(evaluateFieldRules(rules, snap({ to: ["p@partner.vn"], cc: ["q@partner.vn"] }))).toEqual(
      [],
    );
  });
  it("reports missing when nobody matches", () => {
    expect(view(evaluateFieldRules(rules, snap({ to: ["x@other.com"] })))).toEqual([
      [0, "missing", undefined, undefined],
    ]);
    expect(view(evaluateFieldRules(rules, snap()))).toEqual([[0, "missing", undefined, undefined]]);
  });
  it("reports misplaced when the match sits only in another field", () => {
    expect(
      view(evaluateFieldRules(rules, snap({ bcc: ["p@partner.vn"], to: ["q@partner.vn"] }))),
    ).toEqual([[0, "misplaced", "q@partner.vn", "to"]]);
  });
});

describe("evaluateFieldRules: mustNotBeIn and onlyIn", () => {
  it("mustNotBeIn reports every match in the field and none elsewhere", () => {
    const rules = [rule("mustNotBeIn", "bcc", "client.com")];
    expect(evaluateFieldRules(rules, snap({ to: ["a@client.com"], cc: ["b@client.com"] }))).toEqual(
      [],
    );
    expect(
      view(
        evaluateFieldRules(rules, snap({ bcc: ["a@client.com", "z@other.com", "b@client.com"] })),
      ),
    ).toEqual([
      [0, "forbidden", "a@client.com", "bcc"],
      [0, "forbidden", "b@client.com", "bcc"],
    ]);
  });
  it("onlyIn reports matches outside the field and passes absent or well-placed ones", () => {
    const rules = [rule("onlyIn", "to", "*.client.com")];
    expect(evaluateFieldRules(rules, snap())).toEqual([]);
    expect(evaluateFieldRules(rules, snap({ to: ["a@m.client.com"] }))).toEqual([]);
    expect(
      view(
        evaluateFieldRules(
          rules,
          snap({ to: ["a@m.client.com"], cc: ["b@x.client.com"], bcc: ["c@m.client.com"] }),
        ),
      ),
    ).toEqual([
      [0, "misplaced", "b@x.client.com", "cc"],
      [0, "misplaced", "c@m.client.com", "bcc"],
    ]);
  });
});

describe("evaluateFieldRules: conditions and patterns", () => {
  const rules = [rule("mustBeIn", "cc", "partner.vn", "anyExternal")];
  it("applies anyExternal only when someone is outside the sender's domain", () => {
    expect(evaluateFieldRules(rules, snap({ to: ["colleague@auditfirm.vn"] }))).toEqual([]);
    expect(
      view(evaluateFieldRules(rules, snap({ to: ["colleague@auditfirm.vn", "x@client.com"] }))),
    ).toEqual([[0, "missing", undefined, undefined]]);
  });
  it("counts unresolved recipients and an unknown sender as external", () => {
    expect(evaluateFieldRules(rules, snap({ to: ["Nguyen A"] }))).toHaveLength(1);
    expect(evaluateFieldRules(rules, snap({ to: ["a@auditfirm.vn"] }, ""))).toHaveLength(1);
    expect(evaluateFieldRules(rules, snap({ bcc: ["a@auditfirm.vn"] }))).toEqual([]);
  });
  it("applies the condition to every rule type", () => {
    const r = [rule("mustNotBeIn", "bcc", "auditfirm.vn", "anyExternal")];
    expect(evaluateFieldRules(r, snap({ bcc: ["a@auditfirm.vn"] }))).toEqual([]);
    expect(
      evaluateFieldRules(r, snap({ bcc: ["a@auditfirm.vn"], to: ["x@client.com"] })),
    ).toHaveLength(1);
  });
  it("matches addresses, domains and *.domain, case-insensitively", () => {
    const r = [
      rule("mustNotBeIn", "bcc", "Boss@Client.com"),
      rule("mustNotBeIn", "bcc", "other.org"),
      rule("mustNotBeIn", "bcc", "*.deep.net"),
    ];
    const out = evaluateFieldRules(
      r,
      snap({ bcc: ["boss@client.COM", "x@other.org", "y@a.deep.net", "z@deep.net"] }),
    );
    expect(out.map((v) => [v.ruleIndex, v.entry?.address])).toEqual([
      [0, "boss@client.COM"],
      [1, "x@other.org"],
      [2, "y@a.deep.net"],
    ]);
  });
  it("ignores * and unparseable patterns and handles an empty list", () => {
    const r = [
      rule("mustNotBeIn", "bcc", "*"),
      rule("mustBeIn", "to", "a@@b"),
      rule("onlyIn", "to", ""),
    ];
    expect(evaluateFieldRules(r, snap({ bcc: ["a@x.vn"] }))).toEqual([]);
    expect(evaluateFieldRules([], snap({ bcc: ["a@x.vn"] }))).toEqual([]);
  });
  it("carries the rule and its index, and never changes the mail", () => {
    const s = snap({ bcc: ["a@client.com"] });
    const before = JSON.stringify(s);
    const r = [rule("mustBeIn", "to", "zzz.vn"), rule("mustNotBeIn", "bcc", "client.com")];
    const out = evaluateFieldRules(r, s);
    expect(out.map((v) => v.ruleIndex)).toEqual([0, 1]);
    expect(out[1]?.rule).toBe(r[1]);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("detectFieldRuleConflicts (FR-8.4)", () => {
  const pairs = (rules: FieldRule[]) =>
    detectFieldRuleConflicts(rules).map((c) => [rules.indexOf(c.a), rules.indexOf(c.b)]);

  it.each([
    [
      "mustBeIn and mustNotBeIn for the same field",
      rule("mustBeIn", "cc", "p.vn"),
      rule("mustNotBeIn", "cc", "p.vn"),
    ],
    [
      "mustNotBeIn and mustBeIn, either order",
      rule("mustNotBeIn", "cc", "p.vn"),
      rule("mustBeIn", "cc", "p.vn"),
    ],
    ["mustBeIn X and onlyIn Y", rule("mustBeIn", "cc", "p.vn"), rule("onlyIn", "to", "p.vn")],
    ["onlyIn X and mustNotBeIn X", rule("onlyIn", "to", "p.vn"), rule("mustNotBeIn", "to", "p.vn")],
    ["onlyIn X and onlyIn Y", rule("onlyIn", "to", "p.vn"), rule("onlyIn", "cc", "p.vn")],
    [
      "an address under a domain",
      rule("mustBeIn", "cc", "p.vn"),
      rule("mustNotBeIn", "cc", "x@p.vn"),
    ],
    [
      "a domain over an address",
      rule("mustNotBeIn", "cc", "x@p.vn"),
      rule("mustBeIn", "cc", "p.vn"),
    ],
    [
      "a domain under *.parent",
      rule("mustBeIn", "cc", "*.p.vn"),
      rule("mustNotBeIn", "cc", "m.p.vn"),
    ],
    [
      "case-insensitive equal patterns",
      rule("mustBeIn", "cc", "P.vn"),
      rule("mustNotBeIn", "cc", "p.VN"),
    ],
  ])("reports %s", (_name, a, b) => {
    expect(pairs([a, b])).toEqual([[0, 1]]);
  });

  it.each([
    ["different patterns", rule("mustBeIn", "cc", "p.vn"), rule("mustNotBeIn", "cc", "q.vn")],
    [
      "mustNotBeIn for another field",
      rule("mustBeIn", "cc", "p.vn"),
      rule("mustNotBeIn", "bcc", "p.vn"),
    ],
    ["mustBeIn in two fields", rule("mustBeIn", "cc", "p.vn"), rule("mustBeIn", "to", "p.vn")],
    ["mustBeIn X with onlyIn X", rule("mustBeIn", "cc", "p.vn"), rule("onlyIn", "cc", "p.vn")],
    [
      "onlyIn X with mustNotBeIn Y",
      rule("onlyIn", "to", "p.vn"),
      rule("mustNotBeIn", "cc", "p.vn"),
    ],
    ["two onlyIn for the same field", rule("onlyIn", "to", "p.vn"), rule("onlyIn", "to", "p.vn")],
    ["two mustNotBeIn", rule("mustNotBeIn", "cc", "p.vn"), rule("mustNotBeIn", "cc", "p.vn")],
    [
      "a domain and its *.subdomains",
      rule("mustBeIn", "cc", "p.vn"),
      rule("mustNotBeIn", "cc", "*.p.vn"),
    ],
    ["a sibling domain", rule("mustBeIn", "cc", "m.p.vn"), rule("mustNotBeIn", "cc", "n.p.vn")],
  ])("does not report %s", (_name, a, b) => {
    expect(pairs([a, b])).toEqual([]);
  });

  it("reports each pair once, in rule order, and skips unusable patterns", () => {
    const rules = [
      rule("mustBeIn", "cc", "p.vn"),
      rule("mustNotBeIn", "cc", "p.vn"),
      rule("mustNotBeIn", "cc", "*"),
      rule("onlyIn", "to", "junk@@"),
      rule("onlyIn", "bcc", "x@p.vn"),
    ];
    expect(pairs(rules)).toEqual([
      [0, 1],
      [0, 4],
    ]);
    expect(detectFieldRuleConflicts([])).toEqual([]);
  });
});
