import { describe, expect, it } from "vitest";
import { createCore, createStubCore, findOutsiders, parseRing } from "../src";
import { checkAttachments } from "../src/attachments";
import { sortRecipients } from "../src/order";
import type { ComposeSnapshot, Member, RecipientEntry, Ring } from "../src/model";

describe("createCore", () => {
  const fallback = createStubCore({ evaluations: [], shareCodes: [] });
  const real = createCore({ fallback });

  it("keeps every CoreApi method and replaces only the implemented ones", () => {
    const keys = Object.keys(fallback).sort();
    expect(Object.keys(real).sort()).toEqual(keys);
    expect(real.sortRecipients).not.toBe(fallback.sortRecipients);
    expect(real.findShadowedPatterns).not.toBe(fallback.findShadowedPatterns);
    expect(real.mergePolicy).toBe(fallback.mergePolicy);
    expect(real.evaluate).toBe(fallback.evaluate);
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

  it("checks 50 recipients, 500 members, 20 attachments and sorts well inside 50 ms", () => {
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
    const run = () => {
      findOutsiders(r, snapshot);
      sortRecipients(r, snapshot);
      checkAttachments(r, others, snapshot.attachments, new Date("2026-10-29T00:00:00Z"));
    };
    run(); // warm up
    const started = performance.now();
    run();
    expect(performance.now() - started).toBeLessThan(50);
  });
});
