import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isRingExpired } from "../src/expiry";
import { POLICY_KEYS, POLICY_MODES, type Policy } from "../src/model";
import {
  DEFAULT_POLICY,
  STRICT_POLICY,
  applyFloor,
  mergePolicy,
  rankMode,
  stricter,
} from "../src/policy";
import { NOW, ring, settings } from "./helpers";

const mode = fc.constantFrom(...POLICY_MODES);
const policy = fc.record({
  outsider: mode,
  missingToken: mode,
  foreignRingToken: mode,
  lookalike: mode,
  firstTime: mode,
  fieldRule: mode,
});
const floor = fc.record(
  {
    outsider: mode,
    missingToken: mode,
    foreignRingToken: mode,
    lookalike: mode,
    firstTime: mode,
    fieldRule: mode,
  },
  { requiredKeys: [] },
);

describe("isRingExpired (E-8)", () => {
  it("is false without a date and for a date that does not parse", () => {
    expect(isRingExpired({ expiresAt: null }, NOW)).toBe(false);
    expect(isRingExpired({}, NOW)).toBe(false);
    expect(isRingExpired({ expiresAt: "not a date" }, NOW)).toBe(false);
  });

  it("is true only strictly after the moment", () => {
    expect(isRingExpired({ expiresAt: "2026-11-04T23:59:59Z" }, NOW)).toBe(true);
    expect(isRingExpired({ expiresAt: NOW.toISOString() }, NOW)).toBe(false);
    expect(isRingExpired({ expiresAt: "2026-12-31T00:00:00Z" }, NOW)).toBe(false);
  });
});

describe("modes", () => {
  it("ranks Warn below Acknowledge below Block", () => {
    expect(POLICY_MODES.map(rankMode)).toEqual([0, 1, 2]);
    expect(stricter("warn", "block")).toBe("block");
    expect(stricter("block", "warn")).toBe("block");
    expect(stricter("acknowledge", "acknowledge")).toBe("acknowledge");
  });

  it("ships the Strict preset of the plan (D-04) and an all-Warn default", () => {
    expect(STRICT_POLICY).toEqual({
      outsider: "acknowledge",
      missingToken: "acknowledge",
      foreignRingToken: "block",
      lookalike: "block",
      firstTime: "acknowledge",
      fieldRule: "acknowledge",
    });
    expect(Object.values(DEFAULT_POLICY).every((m) => m === "warn")).toBe(true);
    expect(Object.keys(STRICT_POLICY).sort()).toEqual([...POLICY_KEYS].sort());
  });
});

describe("mergePolicy / applyFloor (AC-1)", () => {
  it("equals the ring policy when the floor is empty, and does not mutate its inputs", () => {
    const r = ring({ policy: STRICT_POLICY });
    const s = settings();
    expect(mergePolicy(r, s)).toEqual(STRICT_POLICY);
    expect(r.policy).toEqual(STRICT_POLICY);
  });

  it("raises a kind to the floor and leaves other kinds alone", () => {
    const r = ring();
    const merged = mergePolicy(r, settings({ policyFloor: { foreignRingToken: "acknowledge" } }));
    expect(merged.foreignRingToken).toBe("acknowledge");
    expect(merged.outsider).toBe("warn");
    expect(r.policy.foreignRingToken).toBe("warn");
  });

  it("never lowers a ring that is stricter than the floor", () => {
    const merged = mergePolicy(
      ring({ policy: { ...DEFAULT_POLICY, lookalike: "block" } }),
      settings({ policyFloor: { lookalike: "acknowledge" } }),
    );
    expect(merged.lookalike).toBe("block");
  });

  it("is the key-wise maximum of ring policy and floor (property)", () => {
    fc.assert(
      fc.property(policy, floor, (p: Policy, f) => {
        const merged = applyFloor(p, f);
        for (const key of POLICY_KEYS) {
          const expected = Math.max(rankMode(p[key]), rankMode(f[key] ?? "warn"));
          expect(rankMode(merged[key])).toBe(expected);
          expect(rankMode(merged[key])).toBeGreaterThanOrEqual(rankMode(p[key]));
        }
      }),
    );
  });

  it("an imported ring that is all Warn can not go below the floor (T-1)", () => {
    const imported = ring({ policy: { ...DEFAULT_POLICY } });
    const strictFloor = Object.fromEntries(POLICY_KEYS.map((k) => [k, "acknowledge"] as const));
    const merged = mergePolicy(imported, settings({ policyFloor: strictFloor }));
    expect(Object.values(merged).every((m) => m === "acknowledge")).toBe(true);
  });
});
