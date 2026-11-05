import { describe, expect, it } from "vitest";
import {
  findLookalikes,
  labelView,
  skeleton,
  splitRegistrable,
  withinDistance,
  type LookalikeInput,
} from "../src/lookalike";
import type { Member, RecipientEntry } from "../src/model";
import { toAsciiLabel } from "../src/normalize";

const NOW = new Date("2026-10-29T00:00:00Z");
const e = (address: string): RecipientEntry => ({ address, displayName: "", resolved: true });
const ringOf = (id: string, domains: string[], expiresAt: string | null = null) => ({
  id,
  expiresAt,
  members: domains.map((value): Member => ({ kind: "domain", value })),
});

function run(
  to: string[],
  over: Partial<LookalikeInput> & { domains?: string[]; from?: string } = {},
) {
  const alpha = ringOf("alpha", over.domains ?? ["abccorp.vn"]);
  return findLookalikes({
    ring: alpha,
    rings: [alpha],
    snapshot: { from: over.from ?? "me@auditfirm.vn", to: to.map(e), cc: [], bcc: [] },
    exceptions: [],
    now: NOW,
    ...over,
  });
}
const summary = (rows: ReturnType<typeof run>) =>
  rows.map((r) => [r.entry.address, r.reference.domain, r.rule]);

describe("findLookalikes: mandatory plan cases", () => {
  it.each([
    ["x@abcc0rp.vn", "skeleton"],
    ["x@abccorp.com", "suffix"],
    ["x@abc-corp.vn", "hyphen"],
    ["x@abccorb.vn", "editDistance"],
    ["x@abcorp.vn", "editDistance"],
    ["x@abccrop.vn", "editDistance"],
    ["x@abccorpp.vn", "editDistance"],
  ])("flags %s against abccorp.vn (%s)", (address, rule) => {
    expect(summary(run([address]))).toEqual([[address, "abccorp.vn", rule]]);
  });

  it("flags the Cyrillic homograph by its punycode form", () => {
    const label = toAsciiLabel("аbccorp");
    expect(label.startsWith("xn--")).toBe(true);
    expect(summary(run([`x@${label}.vn`]))).toEqual([[`x@${label}.vn`, "abccorp.vn", "skeleton"]]);
    expect(summary(run(["x@аbccorp.vn"]))).toEqual([["x@аbccorp.vn", "abccorp.vn", "skeleton"]]);
  });

  it("does not flag exact matches, their subdomains or unrelated domains", () => {
    expect(
      run(["a@abccorp.vn", "b@mail.abccorp.vn", "c@a.b.abccorp.vn", "d@gmail.com", "e@zzzzzz.vn"]),
    ).toEqual([]);
  });

  it("names the pair, the source and the ring (FR-6.3)", () => {
    const [row] = run(["x@abcc0rp.vn"]);
    expect(row?.domain).toBe("abcc0rp.vn");
    expect(row?.reference).toEqual({ domain: "abccorp.vn", source: "ring", ringId: "alpha" });
    expect(row?.field).toBe("to");
  });
});

describe("findLookalikes: references and scope", () => {
  it("uses the sender's own domain as an internal reference", () => {
    const [row] = run(["x@auditf1rm.vn"], { domains: [] });
    expect(row?.reference).toEqual({ domain: "auditfirm.vn", source: "internal", ringId: null });
  });

  it("uses other rings, but not expired ones (D4)", () => {
    const alpha = ringOf("alpha", ["abccorp.vn"]);
    const beta = ringOf("beta", ["betacorp.vn"]);
    const old = ringOf("old", ["oldcorp.vn"], "2026-01-01T00:00:00Z");
    const live = ringOf("live", ["livecorp.vn"], "2027-01-01T00:00:00Z");
    const rows = findLookalikes({
      ring: alpha,
      rings: [alpha, beta, old, live],
      snapshot: {
        from: "me@auditfirm.vn",
        to: [e("x@betac0rp.vn"), e("y@0ldcorp.vn"), e("z@livec0rp.vn")],
        cc: [],
        bcc: [],
      },
      exceptions: [],
      now: NOW,
    });
    expect(rows.map((r) => [r.entry.address, r.reference.source, r.reference.ringId])).toEqual([
      ["x@betac0rp.vn", "otherRing", "beta"],
      ["z@livec0rp.vn", "otherRing", "live"],
    ]);
  });

  it("works without a ring (FR-6.5)", () => {
    const beta = ringOf("beta", ["betacorp.vn"]);
    const rows = findLookalikes({
      ring: null,
      rings: [beta],
      snapshot: { from: "me@auditfirm.vn", to: [e("x@betac0rp.vn")], cc: [], bcc: [] },
      exceptions: [],
      now: NOW,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reference.source).toBe("otherRing");
  });

  it("does not use the bound ring twice when it also appears in the list", () => {
    const rows = run(["x@abcc0rp.vn"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reference.source).toBe("ring");
  });

  it("takes reference domains from addresses, domains and subdomain members", () => {
    const ring = {
      id: "r",
      members: [
        { kind: "address", value: "cfo@alphacorp.vn" },
        { kind: "subdomains", value: "*.betacorp.vn" },
        { kind: "domain", value: "" },
        { kind: "address", value: "broken" },
      ] satisfies Member[],
    };
    const rows = findLookalikes({
      ring,
      rings: [ring],
      snapshot: { from: "", to: [e("a@alph4corp.vn"), e("b@betac0rp.vn")], cc: [], bcc: [] },
      exceptions: [],
      now: NOW,
    });
    expect(rows.map((r) => r.reference.domain)).toEqual(["alphacorp.vn", "betacorp.vn"]);
  });

  it("scans To, CC and BCC in order and keeps one row per recipient", () => {
    const alpha = ringOf("alpha", ["abccorp.vn"]);
    const rows = findLookalikes({
      ring: alpha,
      rings: [alpha],
      snapshot: {
        from: "me@auditfirm.vn",
        to: [e("a@abcc0rp.vn"), e("b@abcc0rp.vn")],
        cc: [e("not an address")],
        bcc: [e("c@abc-corp.vn")],
      },
      exceptions: [],
      now: NOW,
    });
    expect(rows.map((r) => [r.field, r.entry.address])).toEqual([
      ["to", "a@abcc0rp.vn"],
      ["to", "b@abcc0rp.vn"],
      ["bcc", "c@abc-corp.vn"],
    ]);
  });

  it("returns nothing for an empty reference set or empty mail", () => {
    expect(run(["x@abcc0rp.vn"], { domains: [], from: "" })).toEqual([]);
    expect(run([])).toEqual([]);
  });

  it("does not flag two references against each other", () => {
    expect(
      run(["a@abccorp.vn", "b@abcc0rp.vn"], { domains: ["abccorp.vn", "abcc0rp.vn"] }),
    ).toEqual([]);
  });
});

describe("findLookalikes: exceptions (FR-6.4)", () => {
  it("suppresses a confirmed pair in either order and accepts messy input", () => {
    for (const [a, b] of [
      ["abcc0rp.vn", "abccorp.vn"],
      ["abccorp.vn", "abcc0rp.vn"],
      [" ABCC0RP.vn ", "x@Abccorp.vn"],
    ] as const) {
      expect(run(["x@abcc0rp.vn"], { exceptions: [{ a, b }] })).toEqual([]);
    }
  });

  it("only suppresses the named pair, and ignores unusable entries", () => {
    const rows = run(["x@abcc0rp.vn", "y@abccorp.com"], {
      exceptions: [
        { a: "abcc0rp.vn", b: "abccorp.vn" },
        { a: "", b: "abccorp.vn" },
      ],
    });
    expect(summary(rows)).toEqual([["y@abccorp.com", "abccorp.vn", "suffix"]]);
  });

  it("falls through to another reference when one pair is excepted", () => {
    const rows = run(["x@abcc0rp.vn"], {
      domains: ["abccorp.vn", "abcc0rp.com"],
      exceptions: [{ a: "abcc0rp.vn", b: "abccorp.vn" }],
    });
    expect(summary(rows)).toEqual([["x@abcc0rp.vn", "abcc0rp.com", "suffix"]]);
  });
});

describe("findLookalikes: rule details", () => {
  it("prefers skeleton over hyphen, suffix and edit distance", () => {
    expect(summary(run(["x@abcc0rp.com"]))).toEqual([["x@abcc0rp.com", "abccorp.vn", "skeleton"]]);
  });

  it("treats country-code second levels as suffixes", () => {
    expect(summary(run(["x@abccorp.com.vn"]))).toEqual([
      ["x@abccorp.com.vn", "abccorp.vn", "suffix"],
    ]);
    expect(run(["x@mail.abccorp.com.vn"], { domains: ["abccorp.com.vn"] })).toEqual([]);
  });

  it("allows two typos on names longer than 8 characters, one otherwise", () => {
    expect(summary(run(["x@longcompanyname.vn"], { domains: ["longcompanynam.vn"] }))).toHaveLength(
      1,
    );
    expect(
      summary(run(["x@longcompanynxxe.vn"], { domains: ["longcompanyname.vn"] })),
    ).toHaveLength(1);
    expect(run(["x@longcompanyxxxx.vn"], { domains: ["longcompanyname.vn"] })).toEqual([]);
    expect(run(["x@abccxxx.vn"], { domains: ["abccorp.vn"] })).toEqual([]);
    expect(run(["x@abccorpxxx.vn"], { domains: ["abccorp.vn"] })).toEqual([]);
    expect(summary(run(["x@abccorpxx.vn"], { domains: ["abccorp.vn"] }))).toHaveLength(1);
  });

  it("does not apply the edit-distance rule to very short names", () => {
    expect(run(["x@fbt.vn"], { domains: ["fpt.vn"] })).toEqual([]);
    expect(run(["x@abc.vn"], { domains: ["abd.vn"] })).toEqual([]);
    expect(summary(run(["x@abcd.vn"], { domains: ["abce.vn"] }))).toHaveLength(1);
    expect(run(["x@ab.vn"], { domains: ["abcde.vn"] })).toEqual([]);
  });

  it("handles single-label domains and unparseable recipients without throwing", () => {
    expect(run(["x@localhost", "no-at-sign"], { domains: ["localhost"] })).toEqual([]);
  });
});

describe("splitRegistrable", () => {
  it.each([
    ["abccorp.vn", "abccorp", "vn"],
    ["mail.abccorp.vn", "abccorp", "vn"],
    ["abccorp.com.vn", "abccorp", "com.vn"],
    ["a.b.abccorp.co.uk", "abccorp", "co.uk"],
    ["abccorp.com", "abccorp", "com"],
    ["com.vn", "com", "vn"],
    ["mail.example.vn", "example", "vn"],
    ["localhost", "localhost", ""],
    ["a.com.org", "com", "org"],
    ["abc.net.vn", "abc", "net.vn"],
    ["abc.org.vn", "abc", "org.vn"],
    ["abc.gov.vn", "abc", "gov.vn"],
    ["abc.edu.vn", "abc", "edu.vn"],
    ["abc.ac.jp", "abc", "ac.jp"],
    ["abc.or.jp", "abc", "or.jp"],
    ["abc.ne.jp", "abc", "ne.jp"],
    ["abc.go.jp", "abc", "go.jp"],
    ["abc.co.uk", "abc", "co.uk"],
    ["abc.com.au", "abc", "com.au"],
    // National sub-domains (CL-04B, finding F-1)
    ["abc.id.vn", "abc", "id.vn"],
    ["abc.io.vn", "abc", "io.vn"],
    ["abc.biz.vn", "abc", "biz.vn"],
    ["abc.info.vn", "abc", "info.vn"],
    ["abc.name.vn", "abc", "name.vn"],
    ["abc.pro.vn", "abc", "pro.vn"],
    ["abc.health.vn", "abc", "health.vn"],
    ["abc.int.vn", "abc", "int.vn"],
    ["mail.abc.id.vn", "abc", "id.vn"],
    ["abc.ltd.uk", "abc", "ltd.uk"],
    ["abc.plc.uk", "abc", "plc.uk"],
    ["abc.me.uk", "abc", "me.uk"],
    ["abc.sch.uk", "abc", "sch.uk"],
    ["abc.id.au", "abc", "id.au"],
    ["abc.asn.au", "abc", "asn.au"],
    ["abc.ad.jp", "abc", "ad.jp"],
    ["abc.ed.jp", "abc", "ed.jp"],
    ["abc.gr.jp", "abc", "gr.jp"],
    ["abc.lg.jp", "abc", "lg.jp"],
    ["abc.re.kr", "abc", "re.kr"],
    ["abc.pe.kr", "abc", "pe.kr"],
    // Country-specific second levels do not leak to other country codes
    ["abc.biz.uk", "biz", "uk"],
    ["abc.ltd.vn", "ltd", "vn"],
    ["abc.id.uk", "id", "uk"],
    ["abc.io.it", "io", "it"],
    ["abc.ed.vn", "ed", "vn"],
    // Two labels are a suffix on its own, not a registrable name
    ["id.vn", "id", "vn"],
  ])("%s", (domain, primary, suffix) => {
    const parts = splitRegistrable(domain);
    expect([parts.primary, parts.suffix]).toEqual([primary, suffix]);
    expect(parts.domain).toBe(suffix === "" ? primary : `${primary}.${suffix}`);
  });
});

describe("findLookalikes: national sub-domains (CL-04B)", () => {
  it("compares abccorp.id.vn with the trusted abccorp.vn", () => {
    expect(summary(run(["x@abccorp.id.vn"]))).toEqual([
      ["x@abccorp.id.vn", "abccorp.vn", "suffix"],
    ]);
    expect(summary(run(["x@abccorp.io.vn"]))).toEqual([
      ["x@abccorp.io.vn", "abccorp.vn", "suffix"],
    ]);
  });

  it("tells two organisations under id.vn apart instead of merging them", () => {
    const ring = { domains: ["trusted.id.vn"] };
    expect(summary(run(["x@trusted1.id.vn"], ring))).toEqual([
      ["x@trusted1.id.vn", "trusted.id.vn", "editDistance"],
    ]);
    expect(run(["x@evil.id.vn"], ring)).toEqual([]);
    expect(run(["x@trusted.id.vn", "y@mail.trusted.id.vn"], ring)).toEqual([]);
  });

  it("flags a look-alike label under the same sub-domain", () => {
    const ring = { domains: ["abccorp.id.vn"] };
    expect(summary(run(["x@abcc0rp.id.vn"], ring))).toEqual([
      ["x@abcc0rp.id.vn", "abccorp.id.vn", "skeleton"],
    ]);
  });
});

describe("findLookalikes: more rules", () => {
  it("keeps the first reference when a domain is both a ring member and the sender's own", () => {
    const [row] = run(["x@auditf1rm.vn"], { domains: ["auditfirm.vn"] });
    expect(row?.reference).toEqual({ domain: "auditfirm.vn", source: "ring", ringId: "alpha" });
  });

  it("treats a ring that expires exactly now as still valid", () => {
    const alpha = ringOf("alpha", ["abccorp.vn"]);
    const edge = ringOf("edge", ["edgecorp.vn"], NOW.toISOString());
    const rows = findLookalikes({
      ring: alpha,
      rings: [alpha, edge],
      snapshot: { from: "", to: [e("x@edgec0rp.vn")], cc: [], bcc: [] },
      exceptions: [],
      now: NOW,
    });
    expect(rows).toHaveLength(1);
  });

  it("picks the skeleton reference even when another reference shares the skeleton", () => {
    const rows = run(["x@abcc0rp.net"], { domains: ["abccorp.vn", "abcc0rp.com"] });
    expect(summary(rows)).toEqual([["x@abcc0rp.net", "abccorp.vn", "skeleton"]]);
  });

  it("finds typo references two characters shorter or longer", () => {
    expect(summary(run(["x@longcompanyxx.vn"], { domains: ["longcompany.vn"] }))).toHaveLength(1);
    expect(summary(run(["x@longcompany.vn"], { domains: ["longcompanyxx.vn"] }))).toHaveLength(1);
    expect(run(["x@longcompanyxxx.vn"], { domains: ["longcompany.vn"] })).toEqual([]);
  });

  it("allows one typo up to 8 characters and two above", () => {
    expect(run(["x@abcdefxy.vn"], { domains: ["abcdefgh.vn"] })).toEqual([]);
    expect(summary(run(["x@abcdefgx.vn"], { domains: ["abcdefgh.vn"] }))).toHaveLength(1);
    expect(summary(run(["x@abcdefghxy.vn"], { domains: ["abcdefghij.vn"] }))).toHaveLength(1);
  });

  it("exempts a label shorter than 4 even against a longer one", () => {
    expect(run(["x@abc.vn"], { domains: ["abcd.vn"] })).toEqual([]);
    expect(run(["x@abcd.vn"], { domains: ["abc.vn"] })).toEqual([]);
  });
});

describe("skeleton and labelView", () => {
  it("maps digits, multi-character look-alikes and confusable letters", () => {
    expect(skeleton("abcc0rp")).toBe("abccorp");
    expect(skeleton("1abel")).toBe("label");
    expect(skeleton("corn")).toBe("com");
    expect(skeleton("vvork")).toBe("work");
    expect(skeleton("аеорсух")).toBe("aeopcyx");
    expect(skeleton("ονρ")).toBe("ovp");
    expect(skeleton("ıɑɡđłø")).toBe("iagdlo");
    expect(skeleton("оруѕіјԁһԛԝӏ")).toBe("opysijdhqwl");
  });

  it("removes diacritics, upper case and compatibility forms", () => {
    expect(skeleton("Àbcạ")).toBe("abca");
    expect(skeleton("ａｂｃ")).toBe("abc");
    expect(skeleton("ABC")).toBe("abc");
  });

  it("decodes punycode labels and keeps undecodable ones", () => {
    const label = toAsciiLabel("аbccorp");
    expect(labelView(label)).toBe("аbccorp");
    expect(skeleton(label)).toBe("abccorp");
    expect(labelView("xn--!!")).toBe("xn--!!");
    expect(labelView("plain")).toBe("plain");
  });
});

describe("withinDistance (optimal string alignment)", () => {
  it.each([
    ["abc", "abc", 0, true],
    ["abc", "abd", 1, true],
    ["abc", "abcd", 1, true],
    ["abc", "ab", 1, true],
    ["abcd", "abdc", 1, true],
    ["abcd", "badc", 2, true],
    ["abcd", "badc", 1, false],
    ["abc", "xyz", 2, false],
    ["abc", "abcdef", 2, false],
    ["", "ab", 2, true],
    ["", "abc", 2, false],
    ["zab", "xba", 1, false],
    ["zab", "xba", 2, true],
    ["xyab", "xyba", 1, true],
    ["ca", "abc", 2, false],
    ["ca", "abc", 1, false],
  ])("%j vs %j within %i is %s", (a, b, max, expected) => {
    expect(withinDistance(a, b, max)).toBe(expected);
  });

  it("compares by code point", () => {
    expect(withinDistance("a\u{1f600}c", "abc", 1)).toBe(true);
  });
});
