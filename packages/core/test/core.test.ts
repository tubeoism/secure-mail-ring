import { describe, expect, it } from "vitest";
import {
  createCodec,
  createCore,
  createStubCore,
  emptyHistory,
  evaluateFieldRules,
  findFirstTimeRecipients,
  findLookalikes,
  findOutsiders,
  keyIdOf,
  parseRing,
  recordAddresses,
} from "../src";
import { checkAttachments } from "../src/attachments";
import { sortRecipients } from "../src/order";
import type { ComposeSnapshot, Member, RecipientEntry, Ring } from "../src/model";
import { createEvaluate } from "../src/evaluate";
import { NOW, entry, mail, ring } from "./helpers";

describe("createCore", () => {
  const fallback = createStubCore({ evaluations: [], shareCodes: [] });
  const real = createCore({ fallback });

  it("keeps every CoreApi method and, without keys, replaces all but the share-code codec", () => {
    const keys = Object.keys(fallback).sort();
    expect(Object.keys(real).sort()).toEqual(keys);
    for (const key of [
      "evaluate",
      "sortRecipients",
      "findShadowedPatterns",
      "detectFieldRuleConflicts",
      "mergePolicy",
      "diffRings",
      "suggestRing",
    ] as const) {
      expect(real[key]).not.toBe(fallback[key]);
    }
    expect(real.encodeRing).toBe(fallback.encodeRing);
    expect(real.decodeRing).toBe(fallback.decodeRing);
  });

  it("replaces the share-code codec too when it is given keys (CL-05B)", async () => {
    const secret = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    const keyId = keyIdOf(secret);
    const keys = {
      current: () => ({ keyId, secret }),
      byId: (id: string) => (id === keyId ? { keyId, secret } : null),
    };
    const withKeys = createCore({ fallback, keys, now: () => NOW });
    expect(withKeys.encodeRing).not.toBe(fallback.encodeRing);
    expect(withKeys.decodeRing).not.toBe(fallback.decodeRing);
    const meta = { issuer: "an@abccorp.vn", issuedAt: "2026-11-05T08:00:00Z" };
    const code = await withKeys.encodeRing(ring(), meta);
    expect(code.ok).toBe(true);
    expect(await withKeys.decodeRing(code.ok ? code.value : "")).toEqual({
      ok: true,
      value: { keyId, ring: ring(), ...meta },
    });
    // The codec reads expiry from the clock the core was given.
    const dated = await createCodec({ keys, now: () => NOW }).encodeRing(ring(), {
      ...meta,
      expiresAt: "2026-11-06T00:00:00Z",
    });
    const later = createCore({ fallback, keys, now: () => new Date("2026-11-07T00:00:00Z") });
    expect(await later.decodeRing(dated.ok ? dated.value : "")).toEqual({
      ok: false,
      error: { code: "expired" },
    });
  });

  it("reads expiry from the clock it is given, and from the system clock by default", () => {
    const old = ring({ id: "old", expiresAt: "2026-06-30T00:00:00Z" });
    const snapshot = mail({ to: [entry("a@abccorp.vn")] });
    const early = createCore({ fallback, now: () => new Date("2026-01-01T00:00:00Z") });
    const late = createCore({ fallback, now: () => NOW });
    expect(early.suggestRing([old], snapshot)).toBe("old");
    expect(late.suggestRing([old], snapshot)).toBeNull();
    expect(createCore({ fallback }).suggestRing([old], snapshot)).toBeNull();
  });

  it("uses the real field-rule conflict detection", () => {
    const rules = [
      { pattern: "p.vn", type: "mustBeIn", field: "cc" },
      { pattern: "x@p.vn", type: "mustNotBeIn", field: "cc" },
    ] as const;
    expect(fallback.detectFieldRuleConflicts(rules)).toEqual([]);
    expect(real.detectFieldRuleConflicts(rules)).toEqual([{ a: rules[0], b: rules[1] }]);
  });

  it("does not change the fallback it wraps", () => {
    expect(fallback.findShadowedPatterns(["x.vn", "a@x.vn"])).toHaveLength(1);
    expect(real.findShadowedPatterns(["x.vn", "a@x.vn"])).toHaveLength(1);
  });
});

describe("NFR-1 performance", () => {
  const members: Member[] = Array.from({ length: 500 }, (_, i) =>
    i % 3 === 0
      ? { kind: "address", value: `user${i}@corp${i % 40}.vn` }
      : i % 3 === 1
        ? { kind: "domain", value: `corp${i}.vn` }
        : { kind: "subdomains", value: `sub${i}.vn` },
  );
  const recipients = (n: number, prefix: string): RecipientEntry[] =>
    Array.from({ length: n }, (_, i) => ({
      address: `${prefix}${i}@${i % 2 === 0 ? `corp${(i * 7) % 500}.vn` : `x.sub${(i * 11) % 500}.vn`}`,
      displayName: `Name ${i}`,
      resolved: true,
    }));
  const tokens = Array.from({ length: 50 }, (_, i) => `TOKEN${i}`);
  const ring = parseRing({
    schema: "smr/1",
    id: "perf",
    rev: 1,
    name: "Perf",
    subjectTag: "[P]",
    owner: "o@x.vn",
    updatedAt: "t",
    members,
    internalDomain: "warn",
    order: {
      to: Array.from({ length: 100 }, (_, i) =>
        i % 2 ? `user${i}@corp${i % 40}.vn` : `corp${i}.vn`,
      ).concat("*"),
      cc: ["*.sub2.vn", "*"],
      bcc: [],
    },
    attachments: { tokens, mode: "any", ignoreInline: true, exemptExtensions: [".ics"] },
    policy: {
      outsider: "warn",
      missingToken: "warn",
      foreignRingToken: "warn",
      lookalike: "warn",
      firstTime: "warn",
      fieldRule: "warn",
    },
    fieldRules: [],
    firstTimeCheck: true,
    expiresAt: null,
  });
  // roamingSettings (about 24 KB for rings) caps the total near 2,000 members; test the cap.
  const otherRings = Array.from({ length: 3 }, (_, r) => ({
    id: `other${r}`,
    members: Array.from({ length: 500 }, (_, i): Member => ({
      kind: "domain",
      value: `partner${r}x${i}.vn`,
    })),
  }));
  const rules = Array.from({ length: 20 }, (_, i) => ({
    pattern: i % 2 ? `corp${i}.vn` : `user${i}@corp${i % 40}.vn`,
    type: (["mustBeIn", "mustNotBeIn", "onlyIn"] as const)[i % 3] ?? "mustBeIn",
    field: (["to", "cc", "bcc"] as const)[i % 3] ?? "to",
  }));

  // Stryker instruments every statement (about 10 times slower), which makes a timing
  // assertion meaningless; the plain `verify` job still runs it.
  const instrumented = "__stryker__" in globalThis;

  it.skipIf(instrumented)(
    "runs every send-time check, alone and through evaluate, on 50 recipients, about 2,000 reference members and 20 attachments inside 50 ms",
    () => {
      expect(ring.ok).toBe(true);
      const r = (ring as { value: Ring }).value;
      const snapshot: ComposeSnapshot = {
        from: "me@corp1.vn",
        subject: "s",
        to: recipients(30, "t"),
        cc: recipients(15, "c"),
        bcc: recipients(5, "b"),
        attachments: Array.from({ length: 20 }, (_, i) => ({
          name: `Report ${i} TOKEN${i}x.xlsx`,
          isInline: false,
          kind: "file" as const,
        })),
        ringId: "perf",
      };
      const others = [r, { ...r, id: "other" }];
      const history = recordAddresses(
        emptyHistory("perf"),
        Array.from({ length: 2000 }, (_, i) => `known${i}@corp${i % 40}.vn`),
      );
      const run = () => {
        findOutsiders(r, snapshot);
        findLookalikes({
          ring: r,
          rings: [r, ...otherRings],
          snapshot,
          exceptions: [],
          now: NOW,
        });
        evaluateFieldRules(rules, snapshot);
        findFirstTimeRecipients({
          ring: r,
          snapshot,
          history,
          settings: { learning: { enabled: false, until: null } },
          now: NOW,
        });
        sortRecipients(r, snapshot);
        checkAttachments(r, others, snapshot.attachments, NOW);
      };
      const evaluate = createEvaluate(() => NOW);
      const runEvaluate = () =>
        evaluate({
          ring: r,
          allRings: [r, ...otherRings.map((o) => ({ ...r, ...o }))],
          settings: {
            schema: "smr/1",
            policyFloor: {},
            lookalikeExceptions: [],
            learning: { enabled: false, until: null },
            language: "en",
          },
          snapshot,
          history,
          acknowledged: [],
        });
      run(); // warm up
      // Best of five: a shared CI runner (and Stryker's instrumented code) adds one-off stalls.
      const times = Array.from({ length: 5 }, () => {
        const started = performance.now();
        run();
        return performance.now() - started;
      });
      expect(Math.min(...times)).toBeLessThan(50);

      // The same scenario through the single entry point of the send path (CL-05 AC-12).
      runEvaluate();
      const evaluateTimes = Array.from({ length: 5 }, () => {
        const started = performance.now();
        runEvaluate();
        return performance.now() - started;
      });
      expect(Math.min(...evaluateTimes)).toBeLessThan(50);
    },
  );
});
