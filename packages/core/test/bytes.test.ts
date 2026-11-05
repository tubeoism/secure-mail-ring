import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  base64urlDecode,
  base64urlEncode,
  concatBytes,
  fromHex,
  toHex,
  utf8Decode,
} from "../src/bytes";
import { utf8 } from "../src/hash";

const bytes = fc.uint8Array({ maxLength: 200 });

describe("hex", () => {
  it("round-trips and rejects bad input", () => {
    fc.assert(
      fc.property(bytes, (b) => {
        expect(fromHex(toHex(b))).toEqual(b);
      }),
    );
    expect(toHex(Uint8Array.of(0, 15, 16, 255))).toBe("000f10ff");
    expect(fromHex("0A0b")).toEqual(Uint8Array.of(10, 11));
    expect(fromHex("abc")).toBeNull();
    expect(fromHex("zz")).toBeNull();
    expect(fromHex("")).toEqual(new Uint8Array(0));
  });
});

describe("concatBytes", () => {
  it("joins in order", () => {
    expect(concatBytes(Uint8Array.of(1), new Uint8Array(0), Uint8Array.of(2, 3))).toEqual(
      Uint8Array.of(1, 2, 3),
    );
    expect(concatBytes()).toEqual(new Uint8Array(0));
  });
});

describe("base64url", () => {
  it("matches Node's encoding and round-trips (property)", () => {
    fc.assert(
      fc.property(bytes, (b) => {
        const text = base64urlEncode(b);
        expect(text).toBe(Buffer.from(b).toString("base64url"));
        expect(base64urlDecode(text)).toEqual(b);
      }),
    );
  });

  it("rejects characters outside the alphabet, impossible lengths and a second spelling", () => {
    expect(base64urlDecode("ab+d")).toBeNull();
    expect(base64urlDecode("ab=d")).toBeNull();
    expect(base64urlDecode("a")).toBeNull();
    expect(base64urlDecode("abcde")).toBeNull();
    // "QQ" is 0x41; "QR" has the same first byte but non-zero leftover bits.
    expect(base64urlDecode("QQ")).toEqual(Uint8Array.of(0x41));
    expect(base64urlDecode("QR")).toBeNull();
    expect(base64urlDecode("")).toEqual(new Uint8Array(0));
  });
});

describe("utf8Decode", () => {
  it("agrees with the strict TextDecoder on any bytes (property)", () => {
    const strict = new TextDecoder("utf-8", { fatal: true });
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 40 }), (b) => {
        let expected: string | null;
        try {
          expected = strict.decode(b);
        } catch {
          expected = null;
        }
        expect(utf8Decode(b)).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });

  it("inverts utf8 on valid text, including astral characters", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 30 }), (s) => {
        expect(utf8Decode(utf8(s))).toBe(s);
      }),
    );
    expect(utf8Decode(utf8("Nhóm 🙂"))).toBe("Nhóm 🙂");
  });

  it("rejects overlong forms, surrogates, values above U+10FFFF and truncation", () => {
    for (const bad of [
      [0xc0, 0x80],
      [0xc1, 0xbf],
      [0xe0, 0x80, 0x80],
      [0xed, 0xa0, 0x80],
      [0xf4, 0x90, 0x80, 0x80],
      [0xf8, 0x80, 0x80, 0x80, 0x80],
      [0x80],
      [0xe2, 0x82],
      [0xc3],
      [0xc3, 0x28],
    ]) {
      expect(utf8Decode(Uint8Array.from(bad)), bad.join(",")).toBeNull();
    }
  });
});
