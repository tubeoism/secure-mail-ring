import { domainToASCII, domainToUnicode } from "node:url";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  domainLabels,
  normalizeAddress,
  normalizeDomain,
  punycodeDecode,
  punycodeEncode,
  splitAddress,
  toAsciiLabel,
} from "../src/normalize";

// RFC 3492 section 7.1 sample strings; expectations cross-checked against Python's codec.
const u = (...points: number[]) => String.fromCodePoint(...points);
const RFC_VECTORS: readonly [string, string, string][] = [
  [
    "Arabic",
    u(
      0x644,
      0x64a,
      0x647,
      0x645,
      0x627,
      0x628,
      0x62a,
      0x643,
      0x644,
      0x645,
      0x648,
      0x634,
      0x639,
      0x631,
      0x628,
      0x64a,
      0x61f,
    ),
    "egbpdaj6bu4bxfgehfvwxn",
  ],
  [
    "Chinese simplified",
    u(0x4ed6, 0x4eec, 0x4e3a, 0x4ec0, 0x4e48, 0x4e0d, 0x8bf4, 0x4e2d, 0x6587),
    "ihqwcrb4cv8a8dqg056pqjye",
  ],
  [
    "Chinese traditional",
    u(0x4ed6, 0x5011, 0x7232, 0x4ec0, 0x9ebd, 0x4e0d, 0x8aaa, 0x4e2d, 0x6587),
    "ihqwctvzc91f659drss3x8bo0yb",
  ],
  ["Czech", "Pročprostěnemluvíčesky", "Proprostnemluvesky-uyb24dma41a"],
  [
    "Hebrew",
    u(
      0x5dc,
      0x5de,
      0x5d4,
      0x5d4,
      0x5dd,
      0x5e4,
      0x5e9,
      0x5d5,
      0x5d8,
      0x5dc,
      0x5d0,
      0x5de,
      0x5d3,
      0x5d1,
      0x5e8,
      0x5d9,
      0x5dd,
      0x5e2,
      0x5d1,
      0x5e8,
      0x5d9,
      0x5ea,
    ),
    "4dbcagdahymbxekheh6e0a7fei0b",
  ],
  [
    "Hindi",
    u(
      0x92f,
      0x939,
      0x932,
      0x94b,
      0x917,
      0x939,
      0x93f,
      0x928,
      0x94d,
      0x926,
      0x940,
      0x915,
      0x94d,
      0x92f,
      0x94b,
      0x902,
      0x928,
      0x939,
      0x940,
      0x902,
      0x92c,
      0x94b,
      0x932,
      0x938,
      0x915,
      0x924,
      0x947,
      0x939,
      0x948,
      0x902,
    ),
    "i1baa7eci9glrd9b2ae1bj0hfcgg6iyaf8o0a1dig0cd",
  ],
  [
    "Japanese",
    u(
      0x306a,
      0x305c,
      0x307f,
      0x3093,
      0x306a,
      0x65e5,
      0x672c,
      0x8a9e,
      0x3092,
      0x8a71,
      0x3057,
      0x3066,
      0x304f,
      0x308c,
      0x306a,
      0x3044,
      0x306e,
      0x304b,
    ),
    "n8jok5ay5dzabd5bym9f0cm5685rrjetr6pdxa",
  ],
  [
    "Korean",
    u(
      0xc138,
      0xacc4,
      0xc758,
      0xbaa8,
      0xb4e0,
      0xc0ac,
      0xb78c,
      0xb4e4,
      0xc774,
      0xd55c,
      0xad6d,
      0xc5b4,
      0xb97c,
      0xc774,
      0xd574,
      0xd55c,
      0xb2e4,
      0xba74,
      0xc5bc,
      0xb9c8,
      0xb098,
      0xc88b,
      0xc744,
      0xae4c,
    ),
    "989aomsvi5e83db1d2a355cv1e0vak1dwrv93d5xbh15a0dt30a5jpsd879ccm6fea98c",
  ],
  [
    "Russian",
    u(
      0x43f,
      0x43e,
      0x447,
      0x435,
      0x43c,
      0x443,
      0x436,
      0x435,
      0x43e,
      0x43d,
      0x438,
      0x43d,
      0x435,
      0x433,
      0x43e,
      0x432,
      0x43e,
      0x440,
      0x44f,
      0x442,
      0x43f,
      0x43e,
      0x440,
      0x443,
      0x441,
      0x441,
      0x43a,
      0x438,
    ),
    "b1abfaaepdrnnbgefbadotcwatmq2g4l",
  ],
  [
    "Spanish",
    "PorquénopuedensimplementehablarenEspañol",
    "PorqunopuedensimplementehablarenEspaol-fmd56a",
  ],
  ["Vietnamese", "TạisaohọkhôngthểchỉnóitiếngViệt", "TisaohkhngthchnitingVit-kjcr8268qyxafd2f1b9g"],
];

describe("punycodeEncode", () => {
  it.each(RFC_VECTORS)("encodes the RFC 3492 sample: %s", (_name, input, expected) => {
    expect(punycodeEncode(input)).toBe(expected);
  });

  it("handles a single code point right after ASCII (U+0080)", () => {
    expect(punycodeEncode("\u0080")).toBe("a");
    expect(punycodeEncode("a\u0080")).toBe("a-ba");
  });

  it("returns pure ASCII unchanged apart from the delimiter rule", () => {
    expect(punycodeEncode("")).toBe("");
    expect(punycodeEncode("abc")).toBe("abc-");
  });

  it("agrees with Node's domainToASCII on random lower-case labels (differential)", () => {
    const letter = fc.oneof(
      fc.integer({ min: 0x61, max: 0x7a }),
      fc.integer({ min: 0xe0, max: 0xff }),
      fc.integer({ min: 0x100, max: 0x17f }),
      fc.integer({ min: 0x430, max: 0x44f }),
      fc.integer({ min: 0x1ea0, max: 0x1ef9 }),
      fc.integer({ min: 0x4e00, max: 0x9fa5 }),
      fc.integer({ min: 0xac00, max: 0xd7a3 }),
    );
    fc.assert(
      fc.property(fc.array(letter, { minLength: 1, maxLength: 20 }), (points) => {
        const label = canonical(u(...points));
        const reference = domainToASCII(label);
        // The reference applies IDNA mapping; compare only where it keeps the label as is.
        fc.pre(reference !== "" && domainToUnicode(reference) === label);
        if ([...label].every((c) => c.charCodeAt(0) < 128)) return;
        expect(toAsciiLabel(label)).toBe(reference);
      }),
      { numRuns: 500 },
    );
  });
});

const canonical = (s: string) => s.normalize("NFC").toLowerCase().normalize("NFC");

describe("splitAddress", () => {
  it("lower-cases both halves and trims", () => {
    expect(splitAddress("  CFO@ABCCorp.VN ")).toEqual({
      ok: true,
      value: { local: "cfo", domain: "abccorp.vn" },
    });
  });

  it("keeps +tag local parts and removes one trailing dot", () => {
    expect(normalizeAddress("A+Tag@Mail.Abccorp.vn.")).toEqual({
      ok: true,
      value: "a+tag@mail.abccorp.vn",
    });
  });

  it("applies NFC so composed and decomposed forms are equal", () => {
    expect(normalizeAddress("é@x.vn")).toEqual(normalizeAddress("é@x.vn"));
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["Nguyen Van A", "noAt"],
    ["a@b@c.vn", "multipleAt"],
    ["@x.vn", "emptyPart"],
    ["a@", "emptyPart"],
    ["a@.", "emptyPart"],
    ["a@x..vn", "badLabel"],
    ["a@.x.vn", "badLabel"],
  ])("rejects %j as %s", (input, code) => {
    expect(splitAddress(input)).toEqual({ ok: false, error: { code } });
  });

  it("rejects addresses over 254 characters and labels over 63", () => {
    expect(splitAddress(`${"a".repeat(250)}@x.vn`)).toEqual({
      ok: false,
      error: { code: "tooLong" },
    });
    expect(splitAddress(`a@${"b".repeat(64)}.vn`)).toEqual({
      ok: false,
      error: { code: "badLabel" },
    });
    expect(splitAddress(`a@${"b".repeat(63)}.vn`).ok).toBe(true);
    expect(splitAddress(`${"a".repeat(240)}@${"b".repeat(10)}.vn`).ok).toBe(true);
    expect(splitAddress(`${"a".repeat(241)}@${"b".repeat(10)}.vn`)).toEqual({
      ok: false,
      error: { code: "tooLong" },
    });
  });

  it("applies the 254 limit again after punycode has lengthened the domain", () => {
    const raw = `${"a".repeat(225)}@${"\u00e9".repeat(25)}.vn`;
    expect(raw.length).toBeLessThanOrEqual(254);
    expect(splitAddress(raw)).toEqual({ ok: false, error: { code: "tooLong" } });
  });

  it("measures the 63-octet label limit after punycode", () => {
    expect(normalizeDomain(`${"é".repeat(60)}.vn`)).toEqual({
      ok: false,
      error: { code: "badLabel" },
    });
  });

  it("rejects whitespace and @ inside domain labels", () => {
    expect(normalizeDomain("a b.vn")).toEqual({ ok: false, error: { code: "badLabel" } });
    expect(normalizeDomain("a@b.vn")).toEqual({ ok: false, error: { code: "badLabel" } });
  });

  it("caps the raw length before normalising, even if NFC would shorten it", () => {
    const decomposed = "e\u0301".repeat(130);
    expect(decomposed.length).toBe(260);
    expect(splitAddress(`${decomposed}@x.vn`)).toEqual({ ok: false, error: { code: "tooLong" } });
  });

  it("applies the 254 limit to the normalised length exactly", () => {
    const domain = `${"\u00e9".repeat(25)}.vn`;
    const d = normalizeDomain(domain);
    expect(d.ok).toBe(true);
    const room = 254 - 1 - (d.ok ? d.value.length : 0);
    expect(splitAddress(`${"a".repeat(room)}@${domain}`).ok).toBe(true);
    expect(splitAddress(`${"a".repeat(room + 1)}@${domain}`)).toEqual({
      ok: false,
      error: { code: "tooLong" },
    });
  });

  it("keeps DEL (U+007F) as an ASCII character", () => {
    expect(toAsciiLabel("a\u007f")).toBe("a\u007f");
  });

  it("keeps a Cyrillic look-alike distinct from its Latin twin", () => {
    const latin = splitAddress("x@abccorp.vn");
    const cyrillic = splitAddress("x@аbccorp.vn");
    expect(latin.ok && cyrillic.ok).toBe(true);
    if (latin.ok && cyrillic.ok) {
      expect(cyrillic.value.domain).toMatch(/^xn--/);
      expect(cyrillic.value.domain).not.toBe(latin.value.domain);
    }
  });

  it("is idempotent for any successfully normalised address (property)", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "binary", maxLength: 60 }),
        fc.string({ unit: "binary", maxLength: 40 }),
        (local, domain) => {
          const first = normalizeAddress(`${local}@${domain}`);
          if (!first.ok) return;
          expect(normalizeAddress(first.value)).toEqual(first);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("is idempotent for realistic internationalised input (property)", () => {
    const part = fc.stringMatching(/^[a-zA-Z0-9À-ſЀ-ӿẠ-ỹ]{1,12}$/);
    fc.assert(
      fc.property(part, fc.array(part, { minLength: 1, maxLength: 3 }), (local, labels) => {
        const first = normalizeAddress(`${local}@${labels.join(".")}.vn`);
        expect(first.ok).toBe(true);
        if (first.ok) expect(normalizeAddress(first.value)).toEqual(first);
      }),
    );
  });
});

describe("domainLabels", () => {
  it("lists labels right to left", () => {
    expect(domainLabels("mail.abccorp.vn")).toEqual(["vn", "abccorp", "mail"]);
  });
});

describe("punycodeDecode", () => {
  it.each(RFC_VECTORS)("decodes the RFC 3492 sample: %s", (_name, input, encoded) => {
    expect(punycodeDecode(encoded)).toBe(input);
  });

  it("round-trips random labels (property)", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 40 }), (label) => {
        const scalar = [...label].filter((c) => {
          const cp = c.codePointAt(0) ?? 0;
          return cp < 0xd800 || cp > 0xdfff;
        });
        const clean = scalar.join("");
        expect(punycodeDecode(punycodeEncode(clean))).toBe(clean);
      }),
      { numRuns: 500 },
    );
  });

  it("handles delimiters and ASCII-only input", () => {
    expect(punycodeDecode("abc-")).toBe("abc");
    expect(punycodeDecode("")).toBe("");
    expect(punycodeDecode("a-ba")).toBe("a\u0080");
    expect(punycodeDecode("-a")).toBe("\u0080");
  });

  it("decodes upper-case digits like lower-case ones", () => {
    expect(punycodeDecode("bcher-KVA")).toBe(punycodeDecode("bcher-kva"));
    expect(punycodeDecode("bcher-kva")).toBe("bücher");
  });

  it.each([
    ["non-ASCII before the delimiter", "é-abc"],
    ["character outside the alphabet", "abc-!!"],
    ["truncated delta", "abc-9"],
    ["overflowing delta", "9".repeat(20)],
    ["code point above U+10FFFF", "99999999a"],
  ])("returns null for %s", (_name, input) => {
    expect(punycodeDecode(input)).toBeNull();
  });

  it("never throws on arbitrary input (property)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (input) => {
        const result = punycodeDecode(input);
        expect(result === null || typeof result === "string").toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});
