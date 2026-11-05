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
