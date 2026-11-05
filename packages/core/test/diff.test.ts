import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { diffRings } from "../src/diff";
import { POLICY_KEYS, POLICY_MODES } from "../src/model";
import { DEFAULT_POLICY, STRICT_POLICY, rankMode } from "../src/policy";
import { members, ring } from "./helpers";

describe("diffRings (FR-2.6, FR-2.7)", () => {
  const before = ring({ rev: 2, members: members("abccorp.vn", "kt@partner.vn") });

  it("reports a new ring: everything added, nothing removed, no policy change", () => {
    const d = diffRings(null, before);
    expect(d.revRelation).toBe("new");
    expect(d.addedMembers).toEqual(before.members);
    expect(d.removedMembers).toEqual([]);
    expect(d.policyChanges).toEqual([]);
  });

  it("classifies the revision", () => {
    expect(diffRings(before, ring({ rev: 3 })).revRelation).toBe("newer");
    expect(diffRings(before, ring({ rev: 2 })).revRelation).toBe("same");
    expect(diffRings(before, ring({ rev: 1 })).revRelation).toBe("older");
  });

  it("lists added and removed members", () => {
    const after = ring({ rev: 3, members: members("abccorp.vn", "evil.com", "*.extra.vn") });
    const d = diffRings(before, after);
    expect(d.addedMembers).toEqual(members("evil.com", "*.extra.vn"));
    expect(d.removedMembers).toEqual(members("kt@partner.vn"));
  });

  it("compares members in normal form, so notation is not a change", () => {
    const after = ring({
      rev: 3,
      members: [
        { kind: "domain", value: "ABCCORP.vn." },
        { kind: "address", value: "KT@Partner.VN" },
      ],
    });
    const d = diffRings(before, after);
    expect(d.addedMembers).toEqual([]);
    expect(d.removedMembers).toEqual([]);
  });

  it("keeps kinds apart: a domain is not the same member as its subdomains", () => {
    const d = diffRings(
      ring({ members: members("abccorp.vn") }),
      ring({ rev: 2, members: members("*.abccorp.vn") }),
    );
    expect(d.addedMembers).toEqual(members("*.abccorp.vn"));
    expect(d.removedMembers).toEqual(members("abccorp.vn"));
  });

  it("compares members that do not parse by their raw text", () => {
    const bad = { kind: "domain", value: "a b" } as const;
    const same = diffRings(ring({ members: [bad] }), ring({ rev: 2, members: [bad] }));
    expect(same.addedMembers).toEqual([]);
    const other = diffRings(
      ring({ members: [bad] }),
      ring({ rev: 2, members: [{ kind: "domain", value: "a  b" }] }),
    );
    expect(other.addedMembers).toHaveLength(1);
  });

  it("flags a loosened policy and not a tightened one", () => {
    const strict = ring({ policy: STRICT_POLICY });
    const loosened = diffRings(strict, ring({ rev: 2, policy: DEFAULT_POLICY }));
    expect(loosened.policyChanges).toContainEqual({
      key: "lookalike",
      from: "block",
      to: "warn",
      loosened: true,
    });
    const tightened = diffRings(
      ring({ policy: DEFAULT_POLICY }),
      ring({ rev: 2, policy: strict.policy }),
    );
    expect(tightened.policyChanges.every((c) => !c.loosened)).toBe(true);
    expect(tightened.policyChanges).toHaveLength(POLICY_KEYS.length);
  });

  it("reports no policy change for equal policies", () => {
    expect(diffRings(ring(), ring({ rev: 2 })).policyChanges).toEqual([]);
  });

  it("is empty against itself (property)", () => {
    const mode = fc.constantFrom(...POLICY_MODES);
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a.vn", "b.vn", "*.c.vn", "x@d.vn"), { maxLength: 6 }),
        mode,
        (vals, m) => {
          const r = ring({ members: members(...vals), policy: { ...DEFAULT_POLICY, outsider: m } });
          const d = diffRings(r, r);
          expect(d.revRelation).toBe("same");
          expect(d.addedMembers).toEqual([]);
          expect(d.removedMembers).toEqual([]);
          expect(d.policyChanges).toEqual([]);
        },
      ),
    );
  });

  it("keeps added and removed apart and marks loosened exactly when the rank drops (property)", () => {
    const pool = ["a.vn", "b.vn", "*.c.vn", "x@d.vn", "y@d.vn"];
    const mode = fc.constantFrom(...POLICY_MODES);
    fc.assert(
      fc.property(fc.subarray(pool), fc.subarray(pool), mode, mode, (left, right, from, to) => {
        const a = ring({
          members: members(...left),
          policy: { ...DEFAULT_POLICY, firstTime: from },
        });
        const b = ring({
          rev: 2,
          members: members(...right),
          policy: { ...DEFAULT_POLICY, firstTime: to },
        });
        const d = diffRings(a, b);
        const added = d.addedMembers.map((m) => m.value);
        const removed = d.removedMembers.map((m) => m.value);
        expect(added.filter((v) => removed.includes(v))).toEqual([]);
        expect(added.length).toBe(right.filter((v) => !left.includes(v)).length);
        const change = d.policyChanges.find((c) => c.key === "firstTime");
        if (from === to) expect(change).toBeUndefined();
        else expect(change?.loosened).toBe(rankMode(to) < rankMode(from));
      }),
    );
  });
});

describe("diffRings: settings that could be weakened unseen (contract-v2, gap G-1, T-1)", () => {
  const base = ring({
    rev: 2,
    internalDomain: "outsider",
    firstTimeCheck: true,
    fieldRules: [{ pattern: "client.com", type: "mustNotBeIn", field: "bcc" }],
    attachments: {
      tokens: ["ALPHA", "IA"],
      mode: "any",
      ignoreInline: false,
      exemptExtensions: ["ics"],
    },
  });
  const newer = (over: Parameters<typeof ring>[0]) => ring({ ...base, rev: 3, ...over });

  it("reports a new ring as everything added and no setting as changed", () => {
    const d = diffRings(null, base);
    expect(d.internalDomainChange).toBeNull();
    expect(d.firstTimeCheckChange).toBeNull();
    expect(d.ignoreInlineChange).toBeNull();
    expect(d.addedFieldRules).toEqual(base.fieldRules);
    expect(d.removedFieldRules).toEqual([]);
    expect(d.addedTokens).toEqual(["ALPHA", "IA"]);
    expect(d.addedExemptExtensions).toEqual(["ics"]);
    expect(d.removedTokens).toEqual([]);
  });

  it("reports nothing for an unchanged copy", () => {
    const d = diffRings(base, newer({}));
    expect(d.internalDomainChange).toBeNull();
    expect(d.firstTimeCheckChange).toBeNull();
    expect(d.ignoreInlineChange).toBeNull();
    for (const list of [
      d.addedFieldRules,
      d.removedFieldRules,
      d.addedTokens,
      d.removedTokens,
      d.addedExemptExtensions,
      d.removedExemptExtensions,
    ]) {
      expect(list).toEqual([]);
    }
  });

  it("marks a weaker treatment of the sender's own domain as loosened, a stricter one as not", () => {
    expect(diffRings(base, newer({ internalDomain: "allow" })).internalDomainChange).toEqual({
      from: "outsider",
      to: "allow",
      loosened: true,
    });
    expect(diffRings(base, newer({ internalDomain: "warn" })).internalDomainChange).toEqual({
      from: "outsider",
      to: "warn",
      loosened: true,
    });
    const stricter = diffRings(
      newer({ internalDomain: "allow" }),
      newer({ internalDomain: "warn" }),
    );
    expect(stricter.internalDomainChange).toEqual({ from: "allow", to: "warn", loosened: false });
  });

  it("marks switching the first-time check off, or ignoring inline images, as loosened", () => {
    expect(diffRings(base, newer({ firstTimeCheck: false })).firstTimeCheckChange).toEqual({
      from: true,
      to: false,
      loosened: true,
    });
    expect(
      diffRings(newer({ firstTimeCheck: false }), newer({ firstTimeCheck: true }))
        .firstTimeCheckChange,
    ).toEqual({ from: false, to: true, loosened: false });
    const inline = (ignoreInline: boolean) => ({
      tokens: ["ALPHA", "IA"],
      mode: "any" as const,
      ignoreInline,
      exemptExtensions: ["ics"],
    });
    expect(diffRings(base, newer({ attachments: inline(true) })).ignoreInlineChange).toEqual({
      from: false,
      to: true,
      loosened: true,
    });
    expect(
      diffRings(newer({ attachments: inline(true) }), newer({ attachments: inline(false) }))
        .ignoreInlineChange,
    ).toEqual({ from: true, to: false, loosened: false });
  });

  it("lists field rules that appeared or vanished, ignoring case and spacing of the pattern", () => {
    const rule = (pattern: string) => ({
      pattern,
      type: "mustNotBeIn" as const,
      field: "bcc" as const,
    });
    const added = rule("other.com");
    const d = diffRings(base, newer({ fieldRules: [rule("  CLIENT.com "), added] }));
    expect(d.addedFieldRules).toEqual([added]);
    expect(d.removedFieldRules).toEqual([]);
    const gone = diffRings(base, newer({ fieldRules: [] }));
    expect(gone.removedFieldRules).toEqual(base.fieldRules);
    // Same pattern with another type or field is a different rule.
    const other = diffRings(
      base,
      newer({ fieldRules: [{ pattern: "client.com", type: "onlyIn", field: "bcc" }] }),
    );
    expect(other.addedFieldRules).toHaveLength(1);
    expect(other.removedFieldRules).toHaveLength(1);
  });

  it("lists attachment tokens and exempt extensions, comparing them in normal form", () => {
    const attachments = (tokens: string[], exemptExtensions: string[]) => ({
      tokens,
      mode: "any" as const,
      ignoreInline: false,
      exemptExtensions,
    });
    const d = diffRings(
      base,
      newer({ attachments: attachments([" alpha", "Ia", "BETA"], ["ICS", "exe"]) }),
    );
    expect(d.addedTokens).toEqual(["BETA"]);
    expect(d.removedTokens).toEqual([]);
    expect(d.addedExemptExtensions).toEqual(["exe"]);
    expect(d.removedExemptExtensions).toEqual([]);
    const fewer = diffRings(base, newer({ attachments: attachments(["ALPHA"], []) }));
    expect(fewer.removedTokens).toEqual(["IA"]);
    expect(fewer.removedExemptExtensions).toEqual(["ics"]);
  });

  it("treats spellings that the attachment check matches alike as one (case, diacritics, leading dot)", () => {
    const attachments = (tokens: string[], exemptExtensions: string[]) => ({
      tokens,
      mode: "any" as const,
      ignoreInline: false,
      exemptExtensions,
    });
    const before = ring({ attachments: attachments(["Hồ sơ", "ALPHA"], ["pdf"]) });
    const same = diffRings(
      before,
      ring({ rev: 2, attachments: attachments(["ho so", " alpha "], [".PDF"]) }),
    );
    expect(same.addedTokens).toEqual([]);
    expect(same.removedTokens).toEqual([]);
    expect(same.addedExemptExtensions).toEqual([]);
    expect(same.removedExemptExtensions).toEqual([]);
    const other = diffRings(
      before,
      ring({ rev: 2, attachments: attachments(["beta"], [".exe", "pdf"]) }),
    );
    expect(other.addedTokens).toEqual(["beta"]);
    expect(other.removedTokens).toEqual(["Hồ sơ", "ALPHA"]);
    expect(other.addedExemptExtensions).toEqual([".exe"]);
  });

  it("never reports a change between a ring and itself, in either direction (property)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("allow", "warn", "outsider"),
        fc.boolean(),
        (internalDomain, firstTimeCheck) => {
          const r = ring({ internalDomain, firstTimeCheck });
          const d = diffRings(r, r);
          expect(d.internalDomainChange).toBeNull();
          expect(d.firstTimeCheckChange).toBeNull();
          expect(d.addedTokens).toEqual([]);
        },
      ),
    );
  });
});
