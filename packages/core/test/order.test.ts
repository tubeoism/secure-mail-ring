import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ComposeSnapshot, RecipientEntry, Ring } from "../src/model";
import {
  findShadowedPatterns,
  parsePattern,
  rankRecipient,
  sameMultiset,
  sameRecipients,
  sortField,
  createSortRecipients,
  sortRecipients,
  sortRecipientsChecked,
} from "../src/order";

const e = (address: string, displayName = ""): RecipientEntry => ({
  address,
  displayName,
  resolved: true,
});
const addresses = (list: readonly RecipientEntry[]) => list.map((x) => x.address);

describe("parsePattern", () => {
  it("recognises the four forms and rejects junk", () => {
    expect(parsePattern("*")).toEqual({ kind: "rest" });
    expect(parsePattern(" * ")).toEqual({ kind: "rest" });
    expect(parsePattern("CFO@ABC.vn")).toEqual({ kind: "address", value: "cfo@abc.vn" });
    expect(parsePattern("ABC.vn")).toEqual({ kind: "domain", value: "abc.vn" });
    expect(parsePattern("*.abc.vn")).toEqual({ kind: "subdomains", value: "abc.vn" });
    expect(parsePattern("a@@b")).toBeNull();
    expect(parsePattern("")).toBeNull();
    expect(parsePattern("*.")).toBeNull();
  });
});

describe("rankRecipient / sortField", () => {
  it("ranks by the first matching pattern, so a specific address must precede its domain", () => {
    const list = [e("x@abccorp.vn"), e("cfo@abccorp.vn"), e("z@other.com")];
    expect(addresses(sortField(["cfo@abccorp.vn", "abccorp.vn", "*"], list))).toEqual([
      "cfo@abccorp.vn",
      "x@abccorp.vn",
      "z@other.com",
    ]);
    // domain first: it shadows the address, both rank 0 and keep the original order
    expect(addresses(sortField(["abccorp.vn", "cfo@abccorp.vn"], list))).toEqual([
      "x@abccorp.vn",
      "cfo@abccorp.vn",
      "z@other.com",
    ]);
  });

  it("puts unmatched recipients last in their original order when there is no *", () => {
    const list = [e("u2@q.com"), e("a@abc.vn"), e("u1@p.com")];
    expect(addresses(sortField(["abc.vn"], list))).toEqual(["a@abc.vn", "u2@q.com", "u1@p.com"]);
  });

  it("lets * place the rest group between other patterns (FR-3.3)", () => {
    const list = [e("u@other.com"), e("a@abc.vn"), e("k@kt.vn")];
    expect(addresses(sortField(["abc.vn", "*", "kt.vn"], list))).toEqual([
      "a@abc.vn",
      "u@other.com",
      "k@kt.vn",
    ]);
  });

  it("matches subdomain patterns and ignores case and invalid patterns", () => {
    const list = [e("a@abc.vn"), e("B@Mail.Beta.VN"), e("c@beta.vn")];
    expect(addresses(sortField(["junk@@", "*.beta.vn", "ABC.vn"], list))).toEqual([
      "B@Mail.Beta.VN",
      "a@abc.vn",
      "c@beta.vn",
    ]);
  });

  it("sends an address that cannot be parsed to the rest group", () => {
    const list = [e("Nguyen Van A"), e("a@abc.vn")];
    expect(addresses(sortField(["abc.vn", "*"], list))).toEqual(["a@abc.vn", "Nguyen Van A"]);
    expect(rankRecipient([parsePattern("abc.vn")], e("Nguyen Van A"))).toBe(1);
  });

  it("keeps the order with an empty list and does not mutate its input", () => {
    const list = [e("b@x.com"), e("a@x.com")];
    const copy = [...list];
    expect(sortField([], list)).toEqual(copy);
    sortField(["a@x.com"], list);
    expect(list).toEqual(copy);
  });

  it("ignores order entries naming addresses that are not in the mail", () => {
    const list = [e("b@x.com"), e("a@x.com")];
    expect(addresses(sortField(["ghost@nowhere.vn", "a@x.com"], list))).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
  });

  it("keeps duplicates of the same address", () => {
    const list = [e("a@x.com", "A1"), e("b@x.com"), e("a@x.com", "A2")];
    expect(sortField(["a@x.com"], list).map((x) => x.displayName)).toEqual(["A1", "A2", ""]);
  });
});

describe("ordering properties (fast-check)", () => {
  const domain = fc.constantFrom("abc.vn", "beta.vn", "m.abc.vn", "other.com");
  const local = fc.constantFrom("a", "b", "cfo", "kt");
  const entry = fc
    .tuple(local, domain, fc.constantFrom("", "N1", "N2"))
    .map(([l, d, n]) => e(`${l}@${d}`, n));
  const entries = fc.array(entry, { maxLength: 12 });
  const pattern = fc.oneof(
    fc.constantFrom("*", "abc.vn", "beta.vn", "*.abc.vn", "other.com", "junk@@"),
    fc.tuple(local, domain).map(([l, d]) => `${l}@${d}`),
  );
  const patterns = fc.array(pattern, { maxLength: 8 });

  it("preserves the multiset of recipients", () => {
    fc.assert(
      fc.property(patterns, entries, (p, list) => {
        expect(sameMultiset(list, sortField(p, list))).toBe(true);
      }),
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(patterns, entries, (p, list) => {
        const once = sortField(p, list);
        expect(sortField(p, once)).toEqual(once);
      }),
    );
  });

  it("is stable: equal ranks keep their original relative order", () => {
    fc.assert(
      fc.property(patterns, entries, (p, list) => {
        const parsed = p.map(parsePattern);
        const indexed = list.map((x, i) => ({ x, i }));
        const sorted = sortField(
          p,
          indexed.map((r) => r.x),
        );
        const positions = new Map(list.map((x, i) => [x, i]));
        for (let i = 1; i < sorted.length; i += 1) {
          const a = sorted[i - 1] as RecipientEntry;
          const b = sorted[i] as RecipientEntry;
          const ra = rankRecipient(parsed, a);
          const rb = rankRecipient(parsed, b);
          expect(ra).toBeLessThanOrEqual(rb);
          if (ra === rb)
            expect(positions.get(a) as number).toBeLessThan(positions.get(b) as number);
        }
      }),
    );
  });

  it("never moves a recipient to another field", () => {
    fc.assert(
      fc.property(
        patterns,
        patterns,
        patterns,
        entries,
        entries,
        entries,
        (po, pc, pb, to, cc, bcc) => {
          const ring = { order: { to: po, cc: pc, bcc: pb } };
          const snapshot = { to, cc, bcc };
          const result = sortRecipientsChecked(ring, snapshot);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          const after = {
            to,
            cc,
            bcc,
            ...Object.fromEntries(result.value.map((m) => [m.field, m.entries])),
          };
          expect(sameRecipients(snapshot, after as typeof snapshot)).toBe(true);
          for (const m of result.value) expect(m.entries).toHaveLength(snapshot[m.field].length);
        },
      ),
    );
  });
});

const baseRing = (order: Ring["order"]) => ({ order }) as unknown as Ring;
const snap = (to: RecipientEntry[], cc: RecipientEntry[] = [], bcc: RecipientEntry[] = []) =>
  ({ from: "me@x.vn", subject: "", to, cc, bcc, attachments: [], ringId: null }) as ComposeSnapshot;

describe("sortRecipients / sortRecipientsChecked", () => {
  it("proposes a mutation only for fields whose order changes", () => {
    const ring = baseRing({ to: ["b.vn", "*"], cc: ["*"], bcc: [] });
    const out = sortRecipients(
      ring,
      snap([e("a@a.vn"), e("b@b.vn")], [e("c@c.vn")], [e("d@d.vn")]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.field).toBe("to");
    expect(addresses(out[0]?.entries ?? [])).toEqual(["b@b.vn", "a@a.vn"]);
  });

  it("proposes nothing when already ordered or when the lists are empty", () => {
    const ring = baseRing({ to: ["a.vn", "*"], cc: [], bcc: [] });
    expect(sortRecipients(ring, snap([e("a@a.vn"), e("b@b.vn")]))).toEqual([]);
    expect(sortRecipients(ring, snap([]))).toEqual([]);
  });

  it("returns no mutations when a corrupt sorter would break the invariant (FR-3.6)", () => {
    const ring = baseRing({ to: ["*"], cc: [], bcc: [] });
    const s = snap([e("a@a.vn"), e("b@b.vn")]);
    const dropping = sortRecipientsChecked(ring, s, (_o, list) => list.slice(1));
    expect(dropping).toEqual({ ok: false, error: { code: "multisetChanged", field: "to" } });
    const duplicating = sortRecipientsChecked(ring, s, (_o, list) => [...list, e("a@a.vn")]);
    expect(duplicating.ok).toBe(false);
    const renaming = sortRecipientsChecked(ring, s, (_o, list) =>
      list.map((x) => ({ ...x, displayName: "Z" })),
    );
    expect(renaming.ok).toBe(false);
    const swapping = sortRecipientsChecked(ring, s, (_o, list) =>
      list.map((x, i) => (i === 0 ? e("zzz@a.vn") : x)),
    );
    expect(swapping.ok).toBe(false);
  });

  it("sortRecipients returns [] instead of mutations when its sorter breaks the invariant", () => {
    const ring = baseRing({ to: ["*"], cc: [], bcc: [] });
    const s = snap([e("a@a.vn"), e("b@b.vn")]);
    expect(createSortRecipients((_o, list) => list.slice(1))(ring, s)).toEqual([]);
    expect(createSortRecipients((_o, list) => [...list].reverse())(ring, s)).toHaveLength(1);
    expect(sortRecipients(ring, s)).toEqual([]);
  });

  it("reports the field that broke the invariant", () => {
    const ring = baseRing({ to: [], cc: ["*"], bcc: [] });
    const s = snap([e("a@a.vn")], [e("b@b.vn")]);
    const result = sortRecipientsChecked(ring, s, (order, list) => (order.length ? [] : list));
    expect(result).toEqual({ ok: false, error: { code: "multisetChanged", field: "cc" } });
  });
});

describe("sameMultiset / sameRecipients", () => {
  it("compares address and display name, counting duplicates", () => {
    expect(sameMultiset([e("a@x"), e("b@x")], [e("b@x"), e("a@x")])).toBe(true);
    expect(sameMultiset([e("a@x"), e("a@x")], [e("a@x"), e("b@x")])).toBe(false);
    expect(sameMultiset([e("a@x"), e("b@x")], [e("a@x"), e("a@x")])).toBe(false);
    expect(sameMultiset([e("a@x", "N")], [e("a@x", "M")])).toBe(false);
    expect(sameMultiset([e("a@x")], [])).toBe(false);
    expect(sameMultiset([], [])).toBe(true);
  });
  it("detects a recipient moved from To to CC", () => {
    const before = { to: [e("a@x")], cc: [], bcc: [] };
    expect(sameRecipients(before, { to: [], cc: [e("a@x")], bcc: [] })).toBe(false);
    expect(sameRecipients(before, { to: [e("a@x")], cc: [], bcc: [] })).toBe(true);
  });
});

describe("findShadowedPatterns (FR-3.4)", () => {
  const cases: readonly [string, string[], [string, string][]][] = [
    [
      "address under an earlier domain",
      ["abccorp.vn", "cfo@abccorp.vn"],
      [["cfo@abccorp.vn", "abccorp.vn"]],
    ],
    [
      "address under an earlier *.parent",
      ["*.abccorp.vn", "x@mail.abccorp.vn"],
      [["x@mail.abccorp.vn", "*.abccorp.vn"]],
    ],
    [
      "domain under an earlier *.parent",
      ["*.abccorp.vn", "mail.abccorp.vn"],
      [["mail.abccorp.vn", "*.abccorp.vn"]],
    ],
    [
      "deeper *.sub under an earlier *.parent",
      ["*.abccorp.vn", "*.mail.abccorp.vn"],
      [["*.mail.abccorp.vn", "*.abccorp.vn"]],
    ],
    ["duplicate address", ["a@x.vn", "A@X.vn"], [["A@X.vn", "a@x.vn"]]],
    ["duplicate domain", ["x.vn", "x.vn"], [["x.vn", "x.vn"]]],
    ["duplicate *.domain", ["*.x.vn", "*.x.vn"], [["*.x.vn", "*.x.vn"]]],
    ["duplicate *", ["*", "*"], [["*", "*"]]],
    [
      "anything after *",
      ["*", "a@x.vn", "x.vn", "*.x.vn"],
      [
        ["a@x.vn", "*"],
        ["x.vn", "*"],
        ["*.x.vn", "*"],
      ],
    ],
    ["reports the first covering pattern", ["x.vn", "*.vn", "a@x.vn"], [["a@x.vn", "x.vn"]]],
  ];
  it.each(cases)("%s", (_name, order, expected) => {
    expect(findShadowedPatterns(order).map((w) => [w.shadowed, w.by])).toEqual(expected);
  });

  const none: readonly [string, string[]][] = [
    ["reversed order (specific first)", ["cfo@abccorp.vn", "abccorp.vn"]],
    ["domain after *.same does not overlap", ["*.abccorp.vn", "abccorp.vn"]],
    ["*.same after domain does not overlap", ["abccorp.vn", "*.abccorp.vn"]],
    ["*.parent after *.sub", ["*.mail.abccorp.vn", "*.abccorp.vn"]],
    ["sibling domains", ["a.vn", "b.vn", "c@a.vn2"]],
    ["address on a parent of a domain pattern", ["x@abccorp.vn", "mail.abccorp.vn"]],
    ["* last", ["a@x.vn", "x.vn", "*"]],
    ["domain suffix that is not a label boundary", ["bccorp.vn", "x@abccorp.vn"]],
    ["address under a longer domain", ["mail.abccorp.vn", "x@abccorp.vn"]],
    ["empty and invalid", ["", "junk@@", "*."]],
    ["empty list", []],
  ];
  it.each(none)("reports nothing for %s", (_name, order) => {
    expect(findShadowedPatterns(order)).toEqual([]);
  });

  it("skips invalid patterns instead of letting them shadow", () => {
    expect(findShadowedPatterns(["junk@@", "x@abc.vn"])).toEqual([]);
  });
});
