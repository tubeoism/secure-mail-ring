import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  parseComposeSnapshot,
  parseHistory,
  parseRing,
  parseSettings,
  parseShareCodePayload,
  LIMITS,
} from "../src/index";

const ring = {
  schema: "smr/1",
  id: "r1",
  rev: 1,
  name: "Alpha",
  subjectTag: "[A]",
  owner: "o@x.vn",
  updatedAt: "2026-10-29T08:00:00Z",
  members: [{ kind: "domain", value: "abccorp.vn" }],
  internalDomain: "allow",
  order: { to: ["*"], cc: [], bcc: [] },
  attachments: { tokens: ["A"], mode: "any", ignoreInline: true, exemptExtensions: [".ics"] },
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
};

describe("parseRing", () => {
  it("accepts a valid ring and survives a JSON round trip", () => {
    const r = parseRing(JSON.parse(JSON.stringify(ring)));
    expect(r).toEqual({ ok: true, value: ring });
  });

  it.each([
    ["unknown schema", { ...ring, schema: "smr/2" }, "schema"],
    ["bad member kind", { ...ring, members: [{ kind: "wildcard", value: "x" }] }, "members.0.kind"],
    [
      "policy outside the enum",
      { ...ring, policy: { ...ring.policy, outsider: "ignore" } },
      "policy.outsider",
    ],
    ["rev below 1", { ...ring, rev: 0 }, "rev"],
    ["unknown extra field", { ...ring, admin: true }, ""],
    [
      "oversize members",
      {
        ...ring,
        members: Array.from({ length: LIMITS.members + 1 }, () => ({
          kind: "address",
          value: "a@b.vn",
        })),
      },
      "members",
    ],
    [
      "oversize order list",
      {
        ...ring,
        order: { ...ring.order, to: Array.from({ length: LIMITS.orderEntries + 1 }, () => "x") },
      },
      "order.to",
    ],
    ["oversize text", { ...ring, name: "x".repeat(LIMITS.text + 1) }, "name"],
  ])("rejects %s without throwing", (_name, input, path) => {
    const r = parseRing(input);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("invalid");
      if (path) expect(r.error.path).toBe(path);
    }
  });

  it("reports a readable message and the dotted path", () => {
    const r = parseRing({ ...ring, members: [{ kind: "address", value: "" }] });
    expect(r).toMatchObject({ ok: false, error: { path: "members.0.value" } });
    if (!r.ok) expect(r.error.message.length).toBeGreaterThan(0);
  });

  it("accepts every attachment kind and field rule trigger", () => {
    for (const kind of ["file", "item", "cloud"]) {
      expect(
        parseComposeSnapshot({
          from: "a@x.vn",
          subject: "s",
          to: [],
          cc: [],
          bcc: [],
          attachments: [{ name: "n", isInline: false, kind }],
          ringId: null,
        }).ok,
      ).toBe(true);
    }
    const withWhen = {
      ...ring,
      fieldRules: [{ pattern: "p", type: "mustBeIn", field: "cc", when: "anyExternal" }],
    };
    expect(parseRing(withWhen).ok).toBe(true);
    expect(
      parseRing({
        ...ring,
        fieldRules: [{ pattern: "p", type: "mustBeIn", field: "cc", when: "always" }],
      }).ok,
    ).toBe(false);
  });

  it("validates lookalike exception pairs in settings", () => {
    const s = {
      schema: "smr/1",
      policyFloor: {},
      lookalikeExceptions: [{ a: "x.vn", b: "y.vn" }],
      learning: { enabled: false, until: null },
      language: "vi",
    };
    expect(parseSettings(s).ok).toBe(true);
    expect(parseSettings({ ...s, lookalikeExceptions: [{ a: "x.vn" }] }).ok).toBe(false);
  });

  it.each([null, undefined, 42, "ring", [], () => 1])(
    "returns an error for non-object input %#",
    (input) => {
      expect(parseRing(input).ok).toBe(false);
    },
  );

  it("does not let hostile getters escape as exceptions", () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error("boom");
        },
        ownKeys() {
          throw new Error("boom");
        },
      },
    );
    expect(parseRing(hostile)).toEqual({
      ok: false,
      error: { code: "invalid", path: "", message: "unreadable input" },
    });
  });
});

describe("other parsers", () => {
  it("parseSettings accepts valid and rejects bad language and bad floor", () => {
    const s = {
      schema: "smr/1",
      policyFloor: { outsider: "block" },
      lookalikeExceptions: [],
      learning: { enabled: true, until: null },
      language: "en",
    };
    expect(parseSettings(s).ok).toBe(true);
    expect(parseSettings({ ...s, language: "fr" }).ok).toBe(false);
    expect(parseSettings({ ...s, policyFloor: { outsider: "off" } }).ok).toBe(false);
  });

  it("parseComposeSnapshot validates recipient entries", () => {
    const snap = {
      from: "a@x.vn",
      subject: "s",
      to: [{ address: "b@x.vn", displayName: "B", resolved: true }],
      cc: [],
      bcc: [],
      attachments: [{ name: "f.pdf", isInline: false, kind: "file" }],
      ringId: null,
    };
    expect(parseComposeSnapshot(snap).ok).toBe(true);
    expect(parseComposeSnapshot({ ...snap, to: [{ address: 1 }] }).ok).toBe(false);
  });

  it("parseHistory validates the Bloom state", () => {
    const h = { schema: "smr/1", salt: "s", current: "AAAA", previous: null, count: 0 };
    expect(parseHistory(h).ok).toBe(true);
    expect(parseHistory({ ...h, count: -1 }).ok).toBe(false);
    expect(parseHistory({ ...h, current: "x".repeat(9000) }).ok).toBe(false);
  });

  it("parseShareCodePayload wraps a full ring", () => {
    const p = { keyId: "k1", ring, issuer: "o@x.vn", issuedAt: "2026-10-29T08:00:00Z" };
    expect(parseShareCodePayload(p).ok).toBe(true);
    expect(parseShareCodePayload({ ...p, ring: { ...ring, rev: 0 } }).ok).toBe(false);
  });
});

describe("property: parseRing round trip", () => {
  const mode = fc.constantFrom("warn", "acknowledge", "block");
  const member = fc.record({
    kind: fc.constantFrom("address", "domain", "subdomains"),
    value: fc.string({ minLength: 1, maxLength: 60 }),
  });
  const arbRing = fc.record({
    schema: fc.constant("smr/1"),
    id: fc.string({ minLength: 1, maxLength: 40 }),
    rev: fc.integer({ min: 1, max: 1_000_000 }),
    name: fc.string({ minLength: 1, maxLength: 80 }),
    subjectTag: fc.string({ maxLength: 20 }),
    owner: fc.string({ maxLength: 80 }),
    updatedAt: fc.string({ maxLength: 30 }),
    members: fc.array(member, { maxLength: 30 }),
    internalDomain: fc.constantFrom("allow", "warn", "outsider"),
    order: fc.record({
      to: fc.array(fc.string({ maxLength: 40 }), { maxLength: 10 }),
      cc: fc.array(fc.string({ maxLength: 40 }), { maxLength: 10 }),
      bcc: fc.array(fc.string({ maxLength: 40 }), { maxLength: 10 }),
    }),
    attachments: fc.record({
      tokens: fc.array(fc.string({ maxLength: 20 }), { maxLength: 10 }),
      mode: fc.constant("any"),
      ignoreInline: fc.boolean(),
      exemptExtensions: fc.array(fc.string({ maxLength: 8 }), { maxLength: 5 }),
    }),
    policy: fc.record({
      outsider: mode,
      missingToken: mode,
      foreignRingToken: mode,
      lookalike: mode,
      firstTime: mode,
      fieldRule: mode,
    }),
    fieldRules: fc.array(
      fc.record({
        pattern: fc.string({ minLength: 1, maxLength: 40 }),
        type: fc.constantFrom("mustBeIn", "mustNotBeIn", "onlyIn"),
        field: fc.constantFrom("to", "cc", "bcc"),
      }),
      { maxLength: 5 },
    ),
    firstTimeCheck: fc.boolean(),
    expiresAt: fc.option(fc.string({ maxLength: 30 }), { nil: null }),
  });

  it("accepts every generated valid ring and returns it unchanged", () => {
    fc.assert(
      fc.property(arbRing, (r) => {
        expect(parseRing(JSON.parse(JSON.stringify(r)))).toEqual({ ok: true, value: r });
      }),
    );
  });

  it("never throws on arbitrary JSON values", () => {
    fc.assert(fc.property(fc.jsonValue(), (x) => typeof parseRing(x).ok === "boolean"));
  });
});
