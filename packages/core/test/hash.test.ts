import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sha256, utf8 } from "../src/hash";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const reference = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("sha256", () => {
  it("matches the NIST vectors", () => {
    expect(hex(sha256(new Uint8Array()))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(hex(sha256(utf8("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hex(sha256(utf8("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")))).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("matches node:crypto around every padding boundary", () => {
    for (let length = 0; length <= 200; length += 1) {
      const data = Uint8Array.from({ length }, (_, i) => (i * 31 + length) & 255);
      expect(hex(sha256(data))).toBe(reference(data));
    }
  });

  it("matches node:crypto on a long input", () => {
    const data = new Uint8Array(100_000).fill(0x61);
    expect(hex(sha256(data))).toBe(reference(data));
  });

  it("matches node:crypto on random bytes (property)", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (data) => {
        expect(hex(sha256(data))).toBe(reference(data));
      }),
      { numRuns: 300 },
    );
  });

  it("does not modify its input", () => {
    const data = utf8("unchanged");
    const copy = Uint8Array.from(data);
    sha256(data);
    expect(data).toEqual(copy);
  });
});

describe("utf8", () => {
  it("equals TextEncoder on random strings, including astral planes (property)", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 80 }), (text) => {
        expect(utf8(text)).toEqual(new TextEncoder().encode(text));
      }),
      { numRuns: 500 },
    );
  });

  it("encodes each length class and replaces lone surrogates like TextEncoder", () => {
    for (const text of ["a", "é", "€", "\u{1f600}", "\ud800", "x\udc00y", ""]) {
      expect(utf8(text)).toEqual(new TextEncoder().encode(text));
    }
  });
});
