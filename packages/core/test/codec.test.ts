import fc from "fast-check";
import { deflateSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { base64urlEncode, concatBytes, fromHex, toHex } from "../src/bytes";
import {
  BEGIN_MARKER,
  CODE_VERSION,
  END_MARKER,
  MAX_BODY_CHARS,
  MAX_INFLATED_BYTES,
  MAX_INPUT_CHARS,
  createCodec,
  extractBody,
  wrapCode,
  keyIdOf,
  type KeyMaterial,
  type KeyProvider,
} from "../src/codec";
import { utf8 } from "../src/hash";
import { NOW, arbRing, ring } from "./helpers";

// Keys are made up for the tests. A key's id is derived from the key, as in production.
const secret = (n: number) => Uint8Array.from({ length: 32 }, (_, i) => (i * n + n) & 255);
const material = (n: number): KeyMaterial => {
  const s = secret(n);
  return { keyId: keyIdOf(s), secret: s };
};
const keysOf = (...ns: number[]): KeyProvider => ({
  current: () => (ns[0] === undefined ? null : material(ns[0])),
  byId: (id) => ns.map(material).find((k) => k.keyId === id) ?? null,
});

const meta = { issuer: "an@auditfirm.vn", issuedAt: "2026-11-05T08:00:00Z" };
const codec = createCodec({ keys: keysOf(1), now: () => NOW });
const subtle = globalThis.crypto.subtle;

/** A copy on a plain ArrayBuffer, which is what WebCrypto's types ask for. */
const copy = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);

/** Builds a code from raw plaintext with the same envelope as the codec, to craft hostile inputs. */
async function seal(
  plain: Uint8Array,
  opts: { key?: KeyMaterial; version?: number; iv?: Uint8Array } = {},
): Promise<string> {
  const key = opts.key ?? material(1);
  const header = concatBytes(
    Uint8Array.of(opts.version ?? CODE_VERSION),
    fromHex(key.keyId) ?? new Uint8Array(0),
  );
  const iv = opts.iv ?? new Uint8Array(12).fill(7);
  const aes = await subtle.importKey("raw", copy(key.secret), { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
  const sealed = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: copy(iv), additionalData: copy(header) },
      aes,
      copy(plain),
    ),
  );
  return `${BEGIN_MARKER}\n${base64urlEncode(concatBytes(header, iv, sealed))}\n${END_MARKER}`;
}
const sealJson = (value: unknown, opts?: Parameters<typeof seal>[1]) =>
  seal(deflateSync(utf8(JSON.stringify(value))), opts);
const payloadOf = (over: Record<string, unknown> = {}) => ({
  keyId: material(1).keyId,
  ring: ring(),
  issuer: "an@auditfirm.vn",
  issuedAt: "2026-11-05T08:00:00Z",
  ...over,
});
const bodyOf = (code: string) => code.split("\n").slice(1, -1).join("");
const wrapBody = (body: string) => `${BEGIN_MARKER}\n${body}\n${END_MARKER}`;
const rawOf = (code: string) => {
  const body = bodyOf(code);
  const bin = Buffer.from(body, "base64url");
  return new Uint8Array(bin);
};
const fromRaw = (raw: Uint8Array) => wrapBody(base64urlEncode(raw));
const codeOf = async (r = ring()) => {
  const e = await codec.encodeRing(r, meta);
  if (!e.ok) throw new Error(`encode failed: ${e.error.code}`);
  return e.value;
};
const errorOf = async (code: string) => {
  const d = await codec.decodeRing(code);
  return d.ok ? "ok" : d.error.code;
};

afterEach(() => vi.unstubAllGlobals());

describe("codec: format and round trip (FR-2.1)", () => {
  it("writes the markers, a wrapped base64url body, and reads it back", async () => {
    const code = await codeOf();
    const lines = code.split("\n");
    expect(lines[0]).toBe(BEGIN_MARKER);
    expect(lines.at(-1)).toBe(END_MARKER);
    const body = lines.slice(1, -1);
    expect(body.every((l) => /^[A-Za-z0-9_-]+$/.test(l) && l.length <= 64)).toBe(true);
    expect(body.slice(0, -1).every((l) => l.length === 64)).toBe(true);
    const back = await codec.decodeRing(code);
    expect(back).toEqual({
      ok: true,
      value: { keyId: material(1).keyId, ring: ring(), ...meta },
    });
  });

  it("keeps Vietnamese text, emoji and the optional expiry", async () => {
    const r = ring({ name: "Nhóm kiểm toán – Công ty ABC 🙂", subjectTag: "[Ẩn danh]" });
    const e = await codec.encodeRing(r, { ...meta, expiresAt: "2027-01-01T00:00:00Z" });
    expect(e.ok).toBe(true);
    const back = await codec.decodeRing(e.ok ? e.value : "");
    expect(back.ok && back.value.ring).toEqual(r);
    expect(back.ok && back.value.expiresAt).toBe("2027-01-01T00:00:00Z");
  });

  it("uses a fresh IV each time, so equal rings give different codes that both decode", async () => {
    const a = await codeOf();
    const b = await codeOf();
    expect(a).not.toBe(b);
    expect(await errorOf(a)).toBe("ok");
    expect(await errorOf(b)).toBe("ok");
  });

  it("round-trips any valid ring (property)", async () => {
    await fc.assert(
      fc.asyncProperty(arbRing(fc.string({ unit: "binary", maxLength: 40 })), async (r) => {
        const e = await codec.encodeRing(r, meta);
        expect(e.ok).toBe(true);
        const d = await codec.decodeRing(e.ok ? e.value : "");
        expect(d).toEqual({ ok: true, value: { keyId: material(1).keyId, ring: r, ...meta } });
      }),
      { numRuns: 60 },
    );
  });
});

describe("codec: tolerance (FR-2.2)", () => {
  const IGNORABLE = [
    " ",
    "\t",
    "\r",
    "\n",
    ...[0xa0, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0xad].map((c) => String.fromCharCode(c)),
  ];

  it("ignores spaces, line breaks and invisible characters anywhere in the code (property)", async () => {
    const code = await codeOf();
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.nat(code.length), fc.constantFrom(...IGNORABLE)), { maxLength: 25 }),
        async (inserts) => {
          let text = code;
          for (const [at, ch] of [...inserts].sort((x, y) => y[0] - x[0])) {
            text = text.slice(0, at) + ch + text.slice(at);
          }
          expect(await errorOf(text)).toBe("ok");
        },
      ),
      { numRuns: 60 },
    );
  });

  it("finds the code inside a mail: greeting, quoting, signature, trailing padding", async () => {
    const code = await codeOf();
    const quoted = code
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\r\n");
    expect(await errorOf(`Chào anh,\r\n\r\n${code}\r\n\r\nTrân trọng,\r\nAn`)).toBe("ok");
    expect(await errorOf(`On Tue, An wrote:\r\n${quoted}\r\n`)).toBe("ok");
    expect(await errorOf(`${BEGIN_MARKER}\n${bodyOf(code)}==\n${END_MARKER}`)).toBe("ok");
  });

  it("takes the first complete block when a text holds two", async () => {
    const first = await codeOf(ring({ name: "First" }));
    const second = await codeOf(ring({ name: "Second" }));
    const d = await codec.decodeRing(`${first}\n\nand also\n${second}`);
    expect(d.ok && d.value.ring.name).toBe("First");
  });

  it("reports framing problems as malformed", async () => {
    const code = await codeOf();
    for (const bad of [
      "",
      "garbage",
      bodyOf(code),
      code.replace(END_MARKER, ""),
      code.replace(BEGIN_MARKER, ""),
      `${END_MARKER}\n${bodyOf(code)}\n${BEGIN_MARKER}`,
      wrapBody(""),
      wrapBody("not base64!"),
      wrapBody("A"),
      wrapBody("AAAAA"),
    ]) {
      expect(await errorOf(bad), bad.slice(0, 30)).toBe("malformed");
    }
  });

  it("extractBody returns the cleaned body or a typed error", () => {
    expect(extractBody(`x ${BEGIN_MARKER} ab cd ${END_MARKER} y`)).toEqual({
      ok: true,
      value: "abcd",
    });
    expect(extractBody("nothing")).toEqual({ ok: false, error: { code: "malformed" } });
  });
});

describe("codec: tampering", () => {
  it("never accepts a code with one character of the body changed (property)", async () => {
    const code = await codeOf();
    const body = bodyOf(code);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    await fc.assert(
      fc.asyncProperty(fc.nat(body.length - 1), fc.nat(alphabet.length - 1), async (at, pick) => {
        const replacement = alphabet.charAt(pick);
        fc.pre(replacement !== body.charAt(at));
        const changed = body.slice(0, at) + replacement + body.slice(at + 1);
        const e = await errorOf(wrapBody(changed));
        expect(["tampered", "malformed", "unsupported"]).toContain(e);
      }),
      { numRuns: 150 },
    );
  });

  it("reports each region of the envelope with its own code", async () => {
    const raw = rawOf(await codeOf());
    const flip = (i: number) => {
      const c = raw.slice();
      c[i] = (c[i] ?? 0) ^ 0x01;
      return fromRaw(c);
    };
    expect(await errorOf(flip(0))).toBe("unsupported"); // version
    expect(await errorOf(flip(3))).toBe("unsupported"); // key id: unknown key
    expect(await errorOf(flip(12))).toBe("tampered"); // IV
    expect(await errorOf(flip(30))).toBe("tampered"); // ciphertext
    expect(await errorOf(flip(raw.length - 1))).toBe("tampered"); // tag
    expect(await errorOf(fromRaw(raw.slice(0, raw.length - 3)))).toBe("tampered");
    expect(await errorOf(fromRaw(raw.slice(0, 30)))).toBe("malformed");
  });

  it("does not decode a code from another key and gives no hint of its content", async () => {
    const foreign = await createCodec({ keys: keysOf(2), now: () => NOW }).encodeRing(ring(), meta);
    expect(await errorOf(foreign.ok ? foreign.value : "")).toBe("unsupported");
    const overlap = createCodec({ keys: keysOf(1, 2), now: () => NOW });
    expect((await overlap.decodeRing(foreign.ok ? foreign.value : "")).ok).toBe(true);
  });

  it("reads codes made with an older key after rotation, writes with the newest", async () => {
    const old = await createCodec({ keys: keysOf(2), now: () => NOW }).encodeRing(ring(), meta);
    const rotated = createCodec({ keys: keysOf(1, 2), now: () => NOW });
    expect((await rotated.decodeRing(old.ok ? old.value : "")).ok).toBe(true);
    const fresh = await rotated.encodeRing(ring(), meta);
    const d = await rotated.decodeRing(fresh.ok ? fresh.value : "");
    expect(d.ok && d.value.keyId).toBe(material(1).keyId);
  });
});

describe("codec: limits and hostile content (D4)", () => {
  it("rejects an oversize input before looking at it", async () => {
    expect(await errorOf("a".repeat(MAX_INPUT_CHARS + 1))).toBe("tooLarge");
  });

  it("rejects an oversize body", async () => {
    expect(await errorOf(wrapBody("A".repeat(MAX_BODY_CHARS + 1)))).toBe("tooLarge");
    expect(await errorOf(wrapBody("A".repeat(MAX_BODY_CHARS)))).not.toBe("tooLarge");
  });

  it("stops a decompression bomb at the output cap", async () => {
    const bomb = deflateSync(new Uint8Array(20_000_000));
    expect(bomb.length).toBeLessThan(MAX_BODY_CHARS * 0.7);
    const started = Date.now();
    expect(await errorOf(await seal(bomb))).toBe("tooLarge");
    expect(Date.now() - started).toBeLessThan(5_000);
    // Just under the cap is let through to the next check (here: not valid JSON).
    expect(await errorOf(await seal(deflateSync(new Uint8Array(MAX_INFLATED_BYTES))))).toBe(
      "malformed",
    );
  });

  it("calls authenticated but unreadable content malformed", async () => {
    expect(await errorOf(await seal(Uint8Array.of(1, 2, 3, 4, 5)))).toBe("malformed"); // not deflate
    expect(await errorOf(await seal(deflateSync(Uint8Array.of(0xff, 0xfe, 0xfd))))).toBe(
      "malformed",
    ); // not UTF-8
    expect(await errorOf(await seal(deflateSync(utf8("not json"))))).toBe("malformed");
    expect(await errorOf(await sealJson({}))).toBe("malformed"); // schema
    expect(await errorOf(await sealJson(payloadOf({ ring: { ...ring(), rev: 0 } })))).toBe(
      "malformed",
    );
    expect(await errorOf(await sealJson(payloadOf({ extra: 1 })))).toBe("malformed"); // strict object
    expect(await errorOf(await sealJson(payloadOf({ keyId: "0000000000000000" })))).toBe(
      "malformed",
    );
  });

  it("checks the lifetime last, on the injected clock", async () => {
    const at = (iso: string) => sealJson(payloadOf({ expiresAt: iso })).then((c) => errorOf(c));
    expect(await at("2026-11-04T23:59:59Z")).toBe("expired");
    expect(await at("2026-11-05T00:00:00Z")).toBe("ok"); // expires exactly now: still valid
    expect(await at("2030-01-01T00:00:00Z")).toBe("ok");
    expect(await at("not a date")).toBe("ok");
  });

  it("never throws on arbitrary text or mutated codes (fuzz)", async () => {
    const code = await codeOf();
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ unit: "binary", maxLength: 300 }),
          fc.string({ maxLength: 300 }).map((s) => `${BEGIN_MARKER}${s}${END_MARKER}`),
          fc.nat(code.length).map((n) => code.slice(0, n)),
          fc
            .tuple(fc.nat(code.length), fc.string({ maxLength: 5 }))
            .map(([n, s]) => code.slice(0, n) + s + code.slice(n)),
        ),
        async (text) => {
          const d = await codec.decodeRing(text);
          expect(typeof d.ok).toBe("boolean");
        },
      ),
      { numRuns: 200 },
    );
    expect(await errorOf(null as unknown as string)).toBe("malformed");
  });
});

describe("codec: framing details", () => {
  it("accepts an input of exactly the size limit and rejects one character more", async () => {
    expect(await errorOf("a".repeat(MAX_INPUT_CHARS))).toBe("malformed");
    expect(await errorOf("a".repeat(MAX_INPUT_CHARS + 1))).toBe("tooLarge");
  });

  it("rejects a character outside the alphabet anywhere in the body, but tolerates end padding", async () => {
    const body = bodyOf(await codeOf());
    const at = 10;
    for (const bad of [
      `!${body}`,
      `${body}!`,
      `${body.slice(0, at)}=${body.slice(at)}`,
      `${body.slice(0, at)}>${body.slice(at)}`,
      `é${body}`,
    ]) {
      expect(await errorOf(wrapBody(bad)), bad.slice(0, 12)).toBe("malformed");
    }
    expect(await errorOf(wrapBody(`${body}==`))).toBe("ok");
  });

  it("strips quoting marks only at the start of a line", async () => {
    const lines = (await codeOf()).split("\n");
    for (const prefix of [">", "> ", ">>", "> > ", "  > ", ">\t"]) {
      expect(await errorOf(lines.map((l) => prefix + l).join("\n")), JSON.stringify(prefix)).toBe(
        "ok",
      );
    }
    const middle = lines.slice();
    middle[1] = `${middle[1]?.slice(0, 10)}>${middle[1]?.slice(10)}`;
    expect(await errorOf(middle.join("\n"))).toBe("malformed");
  });

  it("reads a hostile input of the largest allowed size in linear time", async () => {
    const hostile = [
      " ".repeat(MAX_INPUT_CHARS),
      "\t".repeat(MAX_INPUT_CHARS),
      "> ".repeat(MAX_INPUT_CHARS / 2),
      ">\n".repeat(MAX_INPUT_CHARS / 2),
      "\n".repeat(MAX_INPUT_CHARS),
      `${BEGIN_MARKER}${" ".repeat(MAX_INPUT_CHARS - 100)}`,
      "-----BEGIN".repeat(MAX_INPUT_CHARS / 10),
    ];
    for (const text of hostile) {
      const started = Date.now();
      expect(await errorOf(text.slice(0, MAX_INPUT_CHARS))).toBe("malformed");
      expect(Date.now() - started, text.slice(0, 12)).toBeLessThan(1_000);
    }
  });

  it("wraps at 64 columns and never ends with an empty line", () => {
    for (const n of [1, 63, 64, 65, 128]) {
      const lines = wrapCode("A".repeat(n)).split("\n");
      const body = lines.slice(1, -1);
      expect(
        body.every((l) => l.length > 0 && l.length <= 64),
        String(n),
      ).toBe(true);
      expect(body.join("")).toHaveLength(n);
      expect(lines[0]).toBe(BEGIN_MARKER);
      expect(lines.at(-1)).toBe(END_MARKER);
    }
  });

  it("uses the system clock when none is given", async () => {
    const system = createCodec({ keys: keysOf(1) });
    expect(
      await system.decodeRing(await sealJson(payloadOf({ expiresAt: "2000-01-01T00:00:00Z" }))),
    ).toEqual({
      ok: false,
      error: { code: "expired" },
    });
    expect(
      (await system.decodeRing(await sealJson(payloadOf({ expiresAt: "2999-01-01T00:00:00Z" }))))
        .ok,
    ).toBe(true);
  });

  it("treats a body that is only header and tag long as a failed authentication, not as malformed", async () => {
    const empty = concatBytes(
      Uint8Array.of(CODE_VERSION),
      fromHex(material(1).keyId) ?? new Uint8Array(0),
      new Uint8Array(12),
      new Uint8Array(16),
    );
    expect(await errorOf(fromRaw(empty))).toBe("tampered");
    expect(await errorOf(fromRaw(empty.slice(0, empty.length - 1)))).toBe("malformed");
  });
});

describe("codec: unexpected failures never escape", () => {
  const throwing: KeyProvider = {
    current: () => {
      throw new Error("boom");
    },
    byId: () => {
      throw new Error("boom");
    },
  };

  it("turns a failing key provider into a typed error", async () => {
    const broken = createCodec({ keys: throwing });
    expect(await broken.encodeRing(ring(), meta)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
    expect(await broken.decodeRing(await codeOf())).toEqual({
      ok: false,
      error: { code: "malformed" },
    });
  });

  it("needs both random numbers and the subtle API to write, and the subtle API to read", async () => {
    const code = await codeOf();
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    expect(await codec.encodeRing(ring(), meta)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
    expect(await errorOf(code)).toBe("unsupported");
    vi.stubGlobal("crypto", { subtle: real.subtle });
    expect(await codec.encodeRing(ring(), meta)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
    expect(await errorOf(code)).toBe("ok");
  });
});

describe("codec: encoding errors and missing capabilities", () => {
  it("has no key, a wrong-sized key, or a bad key id: unsupported", async () => {
    const none = createCodec({ keys: keysOf(), now: () => NOW });
    expect(await none.encodeRing(ring(), meta)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
    const short: KeyProvider = {
      current: () => ({ keyId: material(1).keyId, secret: secret(1).slice(0, 16) }),
      byId: () => null,
    };
    expect((await createCodec({ keys: short }).encodeRing(ring(), meta)).ok).toBe(false);
    const badId: KeyProvider = {
      current: () => ({ keyId: "zz", secret: secret(1) }),
      byId: () => null,
    };
    expect(await createCodec({ keys: badId }).encodeRing(ring(), meta)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
    const shortOnRead: KeyProvider = {
      current: () => null,
      byId: () => ({ keyId: material(1).keyId, secret: secret(1).slice(0, 16) }),
    };
    expect(await createCodec({ keys: shortOnRead }).decodeRing(await codeOf())).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });

  it("rejects a ring or metadata that break the schema: malformed", async () => {
    expect(await codec.encodeRing({ ...ring(), rev: 0 }, meta)).toEqual({
      ok: false,
      error: { code: "malformed" },
    });
    expect(await codec.encodeRing(ring(), { ...meta, issuer: "x".repeat(300) })).toEqual({
      ok: false,
      error: { code: "malformed" },
    });
  });

  it("refuses a ring whose code would exceed the size limit: tooLarge", async () => {
    let seed = 12345;
    const noise = (n: number) => {
      let s = "";
      while (s.length < n) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        s += seed.toString(36);
      }
      return s.slice(0, n);
    };
    const members = Array.from({ length: 500 }, () => ({
      kind: "address" as const,
      value: noise(250),
    }));
    expect(await codec.encodeRing(ring({ members }), meta)).toEqual({
      ok: false,
      error: { code: "tooLarge" },
    });
  });

  it("works without WebCrypto only by saying so: unsupported", async () => {
    const code = await codeOf();
    vi.stubGlobal("crypto", undefined);
    expect(await codec.encodeRing(ring(), meta)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
    expect(await errorOf(code)).toBe("unsupported");
    vi.stubGlobal("crypto", { subtle: globalThis.crypto?.subtle });
    expect(await codec.encodeRing(ring(), meta)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });

  it("derives the key id from the key", () => {
    expect(keyIdOf(secret(1))).toMatch(/^[0-9a-f]{16}$/);
    expect(keyIdOf(secret(1))).not.toBe(keyIdOf(secret(2)));
    expect(toHex(new Uint8Array(0))).toBe("");
  });
});
