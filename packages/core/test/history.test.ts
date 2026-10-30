import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  FILTER_BITS,
  GENERATION_CAPACITY,
  MAX_IMPORT,
  emptyHistory,
  findFirstTimeRecipients,
  historyStats,
  isLearning,
  mightContain,
  openHistory,
  parseKnownAddresses,
  recordAddresses,
} from "../src/history";
import { HistorySchema, type HistoryState, type Member, type RecipientEntry } from "../src/model";
import * as v from "valibot";

const addr = (i: number) => `user${i}@host${i % 97}.example.com`;
const e = (address: string): RecipientEntry => ({ address, displayName: "", resolved: true });
const NOW = new Date("2026-10-29T00:00:00Z");
const OFF = { learning: { enabled: false, until: null } } as const;

function record(state: HistoryState, from: number, to: number): HistoryState {
  return recordAddresses(
    state,
    Array.from({ length: to - from }, (_, i) => addr(from + i)),
  );
}

describe("Bloom filter (FR-7.1, FR-7.4)", () => {
  it("starts empty and compact", () => {
    const s = emptyHistory("salt");
    expect(s).toEqual({ schema: "smr/1", salt: "salt", current: "", previous: null, count: 0 });
    expect(mightContain(s, "a@x.vn")).toBe(false);
  });

  it("remembers recorded addresses case-insensitively and ignores invalid ones", () => {
    const s = recordAddresses(emptyHistory("s"), ["A@X.vn", "garbage", "", "b@y.vn"]);
    expect(s.count).toBe(2);
    expect(mightContain(s, "a@x.VN")).toBe(true);
    expect(mightContain(s, "b@y.vn")).toBe(true);
    expect(mightContain(s, "c@z.vn")).toBe(false);
    expect(mightContain(s, "not an address")).toBe(false);
  });

  it("counts an address once, however often it is recorded", () => {
    const once = recordAddresses(emptyHistory("s"), ["a@x.vn", "A@x.vn", "a@x.vn"]);
    expect(once.count).toBe(1);
    expect(recordAddresses(once, ["a@x.vn"])).toEqual(once);
  });

  it("does not modify the state it is given", () => {
    const base = emptyHistory("s");
    const copy = structuredClone(base);
    recordAddresses(base, ["a@x.vn"]);
    expect(base).toEqual(copy);
  });

  it("stays valid under HistorySchema and keeps the salt", () => {
    const s = record(emptyHistory("my-salt"), 0, 1600);
    expect(v.safeParse(HistorySchema, s).success).toBe(true);
    expect(s.salt).toBe("my-salt");
  });

  it("keeps a stored size near the budget of CL-04 D2", () => {
    const s = record(emptyHistory("s"), 0, 3000);
    expect(s.current.length + (s.previous?.length ?? 0)).toBeLessThan(5600);
  });

  it("has no false negatives for the most recent 1,500 addresses (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4500 }), (total) => {
        const s = record(emptyHistory("p"), 0, total);
        const reader = openHistory(s);
        for (let i = Math.max(0, total - GENERATION_CAPACITY); i < total; i += 1) {
          expect(reader.has(addr(i))).toBe(true);
        }
      }),
      { numRuns: 8 },
    );
  });

  it("rotates at capacity: previous keeps the full generation, older ones are dropped", () => {
    const full = record(emptyHistory("r"), 0, GENERATION_CAPACITY);
    expect(full.previous).toBeNull();
    expect(full.count).toBe(GENERATION_CAPACITY);
    const rotated = record(full, GENERATION_CAPACITY, GENERATION_CAPACITY + 1);
    expect(rotated.previous).not.toBeNull();
    expect(rotated.count).toBe(1);
    expect(mightContain(rotated, addr(0))).toBe(true);
    const twice = record(rotated, GENERATION_CAPACITY + 1, GENERATION_CAPACITY * 2 + 101);
    expect(twice.count).toBeLessThanOrEqual(GENERATION_CAPACITY);
    expect(mightContain(twice, addr(GENERATION_CAPACITY + 5))).toBe(true);
    // two generations ago: only false positives remain
    const reader = openHistory(twice);
    let stillThere = 0;
    for (let i = 0; i < 200; i += 1) if (reader.has(addr(i))) stillThere += 1;
    expect(stillThere).toBeLessThan(10);
  });

  it("holds 3,000 distinct addresses with at most 1.2 % false positives", () => {
    const s = record(emptyHistory("fp-test"), 0, 3000);
    expect(s.count).toBe(GENERATION_CAPACITY);
    const reader = openHistory(s);
    for (let i = 0; i < 3000; i += 1) expect(reader.has(addr(i))).toBe(true);
    const probes = 30_000;
    let falsePositives = 0;
    for (let i = 0; i < probes; i += 1) {
      if (reader.has(`probe${i}@elsewhere${i % 31}.org`)) falsePositives += 1;
    }
    expect(falsePositives / probes).toBeLessThanOrEqual(0.012);
    expect(historyStats(s).falsePositiveRate).toBeGreaterThan(0.004);
    expect(historyStats(s).falsePositiveRate).toBeLessThan(0.015);
  });

  it("never stores an address in clear and depends on the salt", () => {
    const a = recordAddresses(emptyHistory("salt-a"), ["secret.person@example.com"]);
    const b = recordAddresses(emptyHistory("salt-b"), ["secret.person@example.com"]);
    expect(JSON.stringify(a)).not.toMatch(/secret|example/);
    expect(a.current).not.toBe(b.current);
    expect(mightContain(b, "secret.person@example.com")).toBe(true);
    expect(openHistory({ ...a, salt: "salt-b" }).has("secret.person@example.com")).toBe(false);
  });

  it("treats corrupt, oversize and malformed filter text as empty, never throwing", () => {
    const good = recordAddresses(emptyHistory("s"), ["a@x.vn"]);
    const broken = { ...good, current: `${good.current}!`, previous: "***" };
    expect(openHistory(broken).has("a@x.vn")).toBe(false);
    const oversize = { ...good, current: "A".repeat(4000) + "B" };
    expect(openHistory(oversize).has("a@x.vn")).toBe(false);
    expect(openHistory({ ...good, previous: null }).has("a@x.vn")).toBe(true);
  });
});

describe("filter encoding", () => {
  const bytesOf = (text: string) => Buffer.from(text, "base64url");

  it("is plain base64url of the bit array without trailing zero bytes", () => {
    for (const total of [1, 2, 3, 5, 40, 400]) {
      const s = record(emptyHistory("enc"), 0, total);
      const bytes = bytesOf(s.current);
      expect(bytes.length).toBeGreaterThan(0);
      expect(bytes[bytes.length - 1]).not.toBe(0);
      expect(Buffer.from(bytes).toString("base64url")).toBe(s.current);
      expect(recordAddresses(s, []).current).toBe(s.current);
    }
  });

  it("encodes an empty filter as an empty string, also after a no-op record", () => {
    expect(recordAddresses(emptyHistory("s"), []).current).toBe("");
    expect(recordAddresses(emptyHistory("s"), ["garbage"]).current).toBe("");
  });

  it("accepts a full-size filter and treats one byte more as corrupt", () => {
    const base = emptyHistory("s");
    expect(openHistory({ ...base, current: "_".repeat(2731) }).has("a@x.vn")).toBe(true);
    expect(openHistory({ ...base, current: "_".repeat(2732) }).has("a@x.vn")).toBe(false);
  });
});

describe("historyStats", () => {
  it("includes the previous generation in the estimate", () => {
    const rotated = record(emptyHistory("s"), 0, 1600);
    expect(rotated.previous).not.toBeNull();
    expect(historyStats(rotated).falsePositiveRate).toBeGreaterThan(0.004);
    expect(historyStats({ ...rotated, previous: null }).falsePositiveRate).toBeLessThan(0.0001);
  });

  it("reports capacity, count and a rising false-positive estimate", () => {
    const empty = historyStats(emptyHistory("s"));
    expect(empty).toEqual({ count: 0, capacity: GENERATION_CAPACITY, falsePositiveRate: 0 });
    const some = historyStats(record(emptyHistory("s"), 0, 100));
    expect(some.count).toBe(100);
    expect(some.falsePositiveRate).toBeGreaterThan(0);
    expect(some.falsePositiveRate).toBeLessThan(0.0001);
    expect(FILTER_BITS).toBe(16_384);
  });
});

describe("parseKnownAddresses (FR-7.3)", () => {
  it("splits on whitespace, comma and semicolon, strips Outlook decoration, dedupes", () => {
    const text = `Nguyen A <A@x.vn>; "b@y.vn", (c@z.vn)\n a@X.vn  not-an-address ;;`;
    const parsed = parseKnownAddresses(text);
    expect(parsed.addresses).toEqual(["a@x.vn", "b@y.vn", "c@z.vn"]);
    expect(parsed.skipped).toBeGreaterThanOrEqual(2);
  });

  it("only strips decoration at the ends of a token", () => {
    expect(parseKnownAddresses('na"me@x.vn').addresses).toEqual(['na"me@x.vn']);
    expect(parseKnownAddresses("a>b@x.vn").addresses).toEqual(["a>b@x.vn"]);
    expect(parseKnownAddresses("<<a@x.vn>>").addresses).toEqual(["a@x.vn"]);
    expect(parseKnownAddresses('("a@x.vn")').addresses).toEqual(["a@x.vn"]);
  });

  it("caps the list and counts what it skipped", () => {
    const text = Array.from({ length: MAX_IMPORT + 25 }, (_, i) => addr(i)).join("\n");
    const parsed = parseKnownAddresses(text);
    expect(parsed.addresses).toHaveLength(MAX_IMPORT);
    expect(parsed.skipped).toBe(25);
    expect(parseKnownAddresses("")).toEqual({ addresses: [], skipped: 0 });
  });

  it("fits in the filter without losing the first address", () => {
    const parsed = parseKnownAddresses(
      Array.from({ length: MAX_IMPORT }, (_, i) => addr(i)).join(" "),
    );
    const s = recordAddresses(emptyHistory("i"), parsed.addresses);
    expect(mightContain(s, addr(0))).toBe(true);
    expect(s.previous).not.toBeNull();
  });
});

describe("isLearning (FR-7.3)", () => {
  it("is on only while enabled and before the end date", () => {
    expect(isLearning({ enabled: false, until: "2099-01-01T00:00:00Z" }, NOW)).toBe(false);
    expect(isLearning({ enabled: true, until: "2099-01-01T00:00:00Z" }, NOW)).toBe(true);
    expect(isLearning({ enabled: true, until: "2020-01-01T00:00:00Z" }, NOW)).toBe(false);
    expect(isLearning({ enabled: true, until: NOW.toISOString() }, NOW)).toBe(false);
    expect(isLearning({ enabled: true, until: null }, NOW)).toBe(true);
    expect(isLearning({ enabled: true, until: "garbage" }, NOW)).toBe(true);
  });
});

describe("findFirstTimeRecipients (FR-7.2, FR-7.6)", () => {
  const member = (kind: Member["kind"], value: string): Member => ({ kind, value });
  const ring = (members: Member[], firstTimeCheck = true) => ({ members, firstTimeCheck });
  const history = recordAddresses(emptyHistory("s"), ["known@x.vn"]);
  const snap = (to: string[], cc: string[] = [], bcc: string[] = []) => ({
    to: to.map(e),
    cc: cc.map(e),
    bcc: bcc.map(e),
  });
  const find = (over: Partial<Parameters<typeof findFirstTimeRecipients>[0]> = {}) =>
    findFirstTimeRecipients({
      ring: ring([]),
      snapshot: snap(["known@x.vn", "new@x.vn"], ["new2@y.vn"], ["new3@z.vn"]),
      history,
      settings: OFF,
      now: NOW,
      ...over,
    });

  it("flags recipients missing from the filter, in field order", () => {
    expect(find().map((r) => [r.field, r.entry.address])).toEqual([
      ["to", "new@x.vn"],
      ["cc", "new2@y.vn"],
      ["bcc", "new3@z.vn"],
    ]);
  });

  it("treats an address member as known but a domain member as not known", () => {
    const r = ring([
      member("address", "NEW@x.vn"),
      member("domain", "y.vn"),
      member("subdomains", "z.vn"),
    ]);
    expect(find({ ring: r }).map((x) => x.entry.address)).toEqual(["new2@y.vn", "new3@z.vn"]);
  });

  it("is silent when the ring switches the check off", () => {
    expect(find({ ring: ring([], false) })).toEqual([]);
  });

  it("checks without a ring, as the check is global when none is chosen", () => {
    expect(find({ ring: null })).toHaveLength(3);
  });

  it("is silent while learning and active afterwards", () => {
    const learning = { learning: { enabled: true, until: "2099-01-01T00:00:00Z" } };
    expect(find({ settings: learning })).toEqual([]);
    const ended = { learning: { enabled: true, until: "2020-01-01T00:00:00Z" } };
    expect(find({ settings: ended })).toHaveLength(3);
  });

  it("skips unresolved recipients and goes quiet once recorded", () => {
    const rows = find({ snapshot: snap(["Nguyen A", "new@x.vn"]) });
    expect(rows.map((r) => r.entry.address)).toEqual(["new@x.vn"]);
    const later = recordAddresses(history, ["new@x.vn", "new2@y.vn", "new3@z.vn"]);
    expect(find({ history: later })).toEqual([]);
  });

  it("keeps one row per entry even when an address repeats across fields", () => {
    expect(find({ snapshot: snap(["new@x.vn"], ["new@x.vn"]) })).toHaveLength(2);
  });
});
