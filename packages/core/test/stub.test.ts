import { describe, expect, it } from "vitest";
import {
  createStubCore,
  parseRing,
  type ComposeSnapshot,
  type EvaluateInput,
  type Ring,
} from "../src/index";

const base = (over: Partial<Ring> = {}): Ring => {
  const r = parseRing({
    schema: "smr/1",
    id: "r1",
    rev: 2,
    name: "A",
    subjectTag: "[A]",
    owner: "o@x.vn",
    updatedAt: "t",
    members: [
      { kind: "domain", value: "abccorp.vn" },
      { kind: "address", value: "k@partner.vn" },
    ],
    internalDomain: "allow",
    order: { to: ["*"], cc: [], bcc: [] },
    attachments: { tokens: ["A"], mode: "any", ignoreInline: true, exemptExtensions: [] },
    policy: {
      outsider: "warn",
      missingToken: "block",
      foreignRingToken: "acknowledge",
      lookalike: "warn",
      firstTime: "warn",
      fieldRule: "warn",
    },
    fieldRules: [],
    firstTimeCheck: true,
    expiresAt: null,
  });
  if (!r.ok) throw new Error("fixture");
  return { ...r.value, ...over };
};
const rec = (address: string) => ({ address, displayName: "", resolved: true });
const snap = (to: string[], cc: string[] = [], bcc: string[] = []): ComposeSnapshot => ({
  from: "me@x.vn",
  subject: "s",
  to: to.map(rec),
  cc: cc.map(rec),
  bcc: bcc.map(rec),
  attachments: [],
  ringId: null,
});
const settings = {
  schema: "smr/1" as const,
  policyFloor: {},
  lookalikeExceptions: [],
  learning: { enabled: false, until: null },
  language: "en" as const,
};
const core = createStubCore({ evaluations: [], shareCodes: [] });

describe("createStubCore", () => {
  it("evaluate allows unknown snapshots", () => {
    const input: EvaluateInput = {
      ring: null,
      allRings: [],
      settings,
      snapshot: snap(["a@b.vn"]),
      history: { schema: "smr/1", salt: "", current: "", previous: null, count: 0 },
      acknowledged: [],
    };
    expect(core.evaluate(input).verdict).toBe("allow");
  });

  it("sortRecipients keeps the multiset and only reports changed fields", () => {
    const s = snap(["b@x.vn", "a@x.vn"], ["c@x.vn"]);
    const m = core.sortRecipients(base(), s);
    expect(m).toHaveLength(1);
    expect(m[0]?.field).toBe("to");
    expect(m[0]?.entries.map((e) => e.address)).toEqual(["a@x.vn", "b@x.vn"]);
  });

  it("findShadowedPatterns flags an address hidden behind its domain", () => {
    expect(core.findShadowedPatterns(["abccorp.vn", "cfo@abccorp.vn", "*"])).toEqual([
      { shadowed: "cfo@abccorp.vn", by: "abccorp.vn" },
    ]);
    expect(core.findShadowedPatterns(["cfo@abccorp.vn", "abccorp.vn"])).toEqual([]);
  });

  it("detectFieldRuleConflicts finds opposed rules on the same pattern and field", () => {
    const a = { pattern: "p@x.vn", type: "mustBeIn", field: "cc" } as const;
    const b = { pattern: "p@x.vn", type: "mustNotBeIn", field: "cc" } as const;
    const c = { pattern: "p@x.vn", type: "mustNotBeIn", field: "bcc" } as const;
    expect(core.detectFieldRuleConflicts([a, b, c])).toEqual([{ a, b }]);
    expect(core.detectFieldRuleConflicts([b, a])).toHaveLength(1);
  });

  it("mergePolicy takes the stricter of ring policy and the global floor", () => {
    const merged = core.mergePolicy(base(), {
      ...settings,
      policyFloor: { outsider: "acknowledge", missingToken: "warn" },
    });
    expect(merged.outsider).toBe("acknowledge");
    expect(merged.missingToken).toBe("block");
  });

  it("diffRings reports members, policy loosening and the revision relation", () => {
    const before = base();
    const after = base({
      rev: 3,
      members: [{ kind: "domain", value: "new.vn" }],
      policy: { ...before.policy, missingToken: "warn" },
    });
    const d = core.diffRings(before, after);
    expect(d.revRelation).toBe("newer");
    expect(d.addedMembers).toEqual([{ kind: "domain", value: "new.vn" }]);
    expect(d.removedMembers).toHaveLength(2);
    expect(d.policyChanges).toEqual([
      { key: "missingToken", from: "block", to: "warn", loosened: true },
    ]);
    expect(core.diffRings(null, after).revRelation).toBe("new");
    expect(core.diffRings(after, after).revRelation).toBe("same");
    expect(core.diffRings(after, before).revRelation).toBe("older");
    expect(core.diffRings(null, after).policyChanges).toEqual([]);
  });

  it("codec stub returns canned codes ignoring whitespace, else typed errors", async () => {
    const ring = base();
    const code = "-----BEGIN MAILRING-----\nabc\ndef\n-----END MAILRING-----";
    const withCodes = createStubCore({
      evaluations: [],
      shareCodes: [{ code, payload: { keyId: "k", ring, issuer: "o", issuedAt: "t" } }],
    });
    expect(await withCodes.encodeRing(ring, { issuer: "o", issuedAt: "t" })).toEqual({
      ok: true,
      value: code,
    });
    expect((await withCodes.decodeRing(code.replace(/\n/g, " \r\n "))).ok).toBe(true);
    expect(await withCodes.decodeRing("garbage")).toEqual({
      ok: false,
      error: { code: "malformed" },
    });
    expect(await core.encodeRing(ring, { issuer: "o", issuedAt: "t" })).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });

  it("suggestRing matches the first recipient by address or domain", () => {
    const r = base();
    expect(core.suggestRing([r], snap(["x@abccorp.vn"]))).toBe("r1");
    expect(core.suggestRing([r], snap([], [], ["K@PARTNER.VN"]))).toBe("r1");
    expect(core.suggestRing([r], snap(["x@other.vn"]))).toBeNull();
    expect(core.suggestRing([r], snap([]))).toBeNull();
  });

  it("evaluate matches by snapshot content and returns the canned result object", () => {
    const hit = snap(["a@b.vn"]);
    const miss = snap(["z@b.vn"]);
    const result = { findings: [], mutations: [], verdict: "warn" as const, fingerprint: "fp" };
    const c = createStubCore({ evaluations: [{ snapshot: hit, result }], shareCodes: [] });
    const input = {
      ring: null,
      allRings: [],
      settings,
      history: { schema: "smr/1" as const, salt: "", current: "", previous: null, count: 0 },
      acknowledged: [],
    };
    expect(c.evaluate({ ...input, snapshot: hit })).toBe(result);
    expect(c.evaluate({ ...input, snapshot: miss })).toEqual({
      findings: [],
      mutations: [],
      verdict: "allow",
      fingerprint: "stub",
    });
  });

  it("shadow detection ignores wildcards, addresses and other domains", () => {
    expect(core.findShadowedPatterns(["*", "a@abccorp.vn"])).toEqual([]);
    expect(core.findShadowedPatterns(["x@abccorp.vn", "y@abccorp.vn"])).toEqual([]);
    expect(core.findShadowedPatterns(["other.vn", "a@abccorp.vn"])).toEqual([]);
  });

  it("rule conflicts need opposed types, equal pattern and equal field", () => {
    const r = (
      type: "mustBeIn" | "mustNotBeIn" | "onlyIn",
      pattern = "p",
      field: "to" | "cc" | "bcc" = "cc",
    ) => ({ pattern, type, field });
    expect(core.detectFieldRuleConflicts([r("mustBeIn"), r("mustBeIn")])).toEqual([]);
    expect(core.detectFieldRuleConflicts([r("mustNotBeIn"), r("mustNotBeIn")])).toEqual([]);
    expect(core.detectFieldRuleConflicts([r("mustBeIn"), r("onlyIn")])).toEqual([]);
    expect(core.detectFieldRuleConflicts([r("mustBeIn", "p"), r("mustNotBeIn", "q")])).toEqual([]);
    expect(
      core.detectFieldRuleConflicts([r("mustBeIn", "p", "to"), r("mustNotBeIn", "p", "cc")]),
    ).toEqual([]);
  });

  it("mergePolicy leaves equal or looser floors alone and ignores unset keys", () => {
    const ring = base();
    expect(core.mergePolicy(ring, settings)).toEqual(ring.policy);
    expect(
      core.mergePolicy(ring, { ...settings, policyFloor: { missingToken: "block" } }).missingToken,
    ).toBe("block");
    expect(
      core.mergePolicy(ring, { ...settings, policyFloor: { foreignRingToken: "acknowledge" } }),
    ).toEqual(ring.policy);
  });

  it("diffRings lists only real member changes and tightening is not loosening", () => {
    const before = base();
    const kept = before.members[0];
    if (!kept) throw new Error("fixture");
    const after = base({
      rev: 3,
      members: [kept, { kind: "address", value: "n@x.vn" }],
      policy: { ...before.policy, outsider: "block" },
    });
    const d = core.diffRings(before, after);
    expect(d.addedMembers).toEqual([{ kind: "address", value: "n@x.vn" }]);
    expect(d.removedMembers).toEqual([before.members[1]]);
    expect(d.policyChanges).toEqual([
      { key: "outsider", from: "warn", to: "block", loosened: false },
    ]);
    expect(core.diffRings(null, after).addedMembers).toHaveLength(2);
    expect(core.diffRings(null, after).removedMembers).toEqual([]);
  });

  it("encodeRing selects the code for the matching ring id", async () => {
    const a = base();
    const b = base({ id: "r2" });
    const c = createStubCore({
      evaluations: [],
      shareCodes: [
        { code: "A", payload: { keyId: "k", ring: a, issuer: "o", issuedAt: "t" } },
        { code: "B", payload: { keyId: "k", ring: b, issuer: "o", issuedAt: "t" } },
      ],
    });
    expect(await c.encodeRing(b, { issuer: "o", issuedAt: "t" })).toEqual({ ok: true, value: "B" });
    expect(await c.decodeRing("  A ")).toMatchObject({ ok: true, value: { ring: { id: "r1" } } });
    expect(await c.decodeRing("A B")).toMatchObject({ ok: false });
  });
});
