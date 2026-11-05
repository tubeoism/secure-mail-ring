// Share-code codec (FR-2.1 to FR-2.8, CL-05B). A ring becomes text that survives mail clients and
// chat tools, and only the organisation's own add-in build can read it back.
//
//   payload JSON -> UTF-8 -> deflate -> AES-GCM -> base64url, between two marker lines.
//
// Binary layout before base64url: version (1) | key id (8) | IV (12) | ciphertext and tag. The
// version and key id are authenticated as additional data. WebCrypto is used only inside functions
// (the send-time runtime may lack it, plan section 5.4) and only the task pane calls them. Nothing
// here throws: every failure is a `CodecError`, in a fixed order so one bad input always gives the
// same code.
import { Inflate, deflateSync } from "fflate";
import { base64urlDecode, base64urlEncode, concatBytes, fromHex, toHex, utf8Decode } from "./bytes";
import type { CodecError } from "./api";
import { sha256, utf8 } from "./hash";
import {
  err,
  ok,
  parseShareCodePayload,
  type Result,
  type Ring,
  type ShareCodePayload,
} from "./model";

export const BEGIN_MARKER = "-----BEGIN MAILRING-----";
export const END_MARKER = "-----END MAILRING-----";
export const CODE_VERSION = 1;
/** Longest accepted base64url body, in characters (about 48 KiB of binary). */
export const MAX_BODY_CHARS = 65_536;
/** Longest accepted input before any cleaning; chat tools and quoting add whitespace. */
export const MAX_INPUT_CHARS = 4 * MAX_BODY_CHARS;
/** Longest accepted plaintext after inflating: a decompression bomb stops here. */
export const MAX_INFLATED_BYTES = 524_288;

const KEY_ID_BYTES = 8;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + KEY_ID_BYTES + IV_BYTES;
const WRAP_COLUMNS = 64;

/** A 32-byte AES key and its public identifier (16 hex characters, derived from the key). */
export interface KeyMaterial {
  readonly keyId: string;
  readonly secret: Uint8Array;
}

/** Where the codec gets keys. The caller builds it (build-time secret plus licence result). */
export interface KeyProvider {
  /** Key used to write new codes, or null when there is none (an unlicensed build). */
  current(): KeyMaterial | null;
  /** The key with this id, or null. */
  byId(keyId: string): KeyMaterial | null;
}

export interface CodecMeta {
  readonly issuer: string;
  readonly issuedAt: string;
  /** Optional lifetime of the code (FR-2.8). */
  readonly expiresAt?: string;
}

export interface CodecOptions {
  readonly keys: KeyProvider;
  readonly now?: () => Date;
}

/** Public identifier of a key: the first 8 bytes of its SHA-256, in hex. */
export function keyIdOf(secret: Uint8Array): string {
  return toHex(sha256(secret).slice(0, KEY_ID_BYTES));
}

interface SubtleLike {
  importKey(
    format: "raw",
    key: Uint8Array,
    algorithm: { name: "AES-GCM" },
    extractable: false,
    usages: readonly ("encrypt" | "decrypt")[],
  ): Promise<unknown>;
  encrypt(
    algorithm: { name: "AES-GCM"; iv: Uint8Array; additionalData: Uint8Array },
    key: unknown,
    data: Uint8Array,
  ): Promise<ArrayBuffer>;
  decrypt(
    algorithm: { name: "AES-GCM"; iv: Uint8Array; additionalData: Uint8Array },
    key: unknown,
    data: Uint8Array,
  ): Promise<ArrayBuffer>;
}

interface CryptoLike {
  readonly subtle?: SubtleLike;
  getRandomValues?(array: Uint8Array): Uint8Array;
}

const cryptoOrNull = (): CryptoLike | null =>
  (globalThis as unknown as { crypto?: CryptoLike }).crypto ?? null;

const fail = (code: CodecError["code"]) => err<CodecError>({ code });

class TooLarge extends Error {}

/** Inflates with an output cap; null for invalid data, throws `TooLarge` past the cap. */
function inflateCapped(data: Uint8Array): Uint8Array | null {
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    const inflate = new Inflate((chunk) => {
      total += chunk.length;
      if (total > MAX_INFLATED_BYTES) throw new TooLarge();
      chunks.push(chunk);
    });
    inflate.push(data, true);
  } catch (e) {
    if (e instanceof TooLarge) throw e;
    return null;
  }
  return concatBytes(...chunks);
}

// Whitespace, line breaks and the invisible characters that chat tools insert or keep.
const INVISIBLE = [0xad, 0x180e, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfeff]
  .map((c) => String.fromCharCode(c))
  .join("");
const IGNORED = new RegExp(`[${/\s/.source}${INVISIBLE}]`, "g");
const QUOTE_PREFIX = /^[ \t]*(?:>[ \t]*)+/gm;
const COMPACT_BEGIN = BEGIN_MARKER.replace(/\s/g, "");
const COMPACT_END = END_MARKER.replace(/\s/g, "");

/** The base64url body of the first complete code block in a text, or an error. */
export function extractBody(input: string): Result<string, CodecError> {
  if (input.length > MAX_INPUT_CHARS) return fail("tooLarge");
  const cleaned = input.replace(QUOTE_PREFIX, "").replace(IGNORED, "");
  const begin = cleaned.indexOf(COMPACT_BEGIN);
  if (begin < 0) return fail("malformed");
  const from = begin + COMPACT_BEGIN.length;
  const end = cleaned.indexOf(COMPACT_END, from);
  if (end < 0) return fail("malformed");
  const body = cleaned.slice(from, end).replace(/=+$/, "");
  if (body.length > MAX_BODY_CHARS) return fail("tooLarge");
  return /^[A-Za-z0-9_-]+$/.test(body) ? ok(body) : fail("malformed");
}

/** The markers around a body wrapped at 64 columns. */
export const wrapCode = (body: string) => {
  const lines: string[] = [];
  for (let i = 0; i < body.length; i += WRAP_COLUMNS) lines.push(body.slice(i, i + WRAP_COLUMNS));
  return `${BEGIN_MARKER}\n${lines.join("\n")}\n${END_MARKER}`;
};

export interface Codec {
  encodeRing(ring: Ring, meta: CodecMeta): Promise<Result<string, CodecError>>;
  decodeRing(code: string): Promise<Result<ShareCodePayload, CodecError>>;
}

export function createCodec({ keys, now = () => new Date() }: CodecOptions): Codec {
  async function encodeRing(ring: Ring, meta: CodecMeta): Promise<Result<string, CodecError>> {
    try {
      const webCrypto = cryptoOrNull();
      const subtle = webCrypto?.subtle;
      const key = keys.current();
      if (
        !webCrypto?.getRandomValues ||
        !subtle ||
        key === null ||
        key.secret.length !== KEY_BYTES
      ) {
        return fail("unsupported");
      }
      const keyIdBytes = fromHex(key.keyId);
      if (keyIdBytes === null || keyIdBytes.length !== KEY_ID_BYTES) return fail("unsupported");

      const payload: ShareCodePayload = {
        keyId: key.keyId,
        ring,
        issuer: meta.issuer,
        issuedAt: meta.issuedAt,
        ...(meta.expiresAt === undefined ? {} : { expiresAt: meta.expiresAt }),
      };
      const checkedPayload = parseShareCodePayload(payload);
      if (!checkedPayload.ok) return fail("malformed");

      const plain = deflateSync(utf8(JSON.stringify(checkedPayload.value)));
      const iv = webCrypto.getRandomValues(new Uint8Array(IV_BYTES));
      const header = concatBytes(Uint8Array.of(CODE_VERSION), keyIdBytes);
      const aesKey = await subtle.importKey("raw", key.secret, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt",
      ]);
      const sealed = new Uint8Array(
        await subtle.encrypt({ name: "AES-GCM", iv, additionalData: header }, aesKey, plain),
      );
      const body = base64urlEncode(concatBytes(header, iv, sealed));
      return body.length > MAX_BODY_CHARS ? fail("tooLarge") : ok(wrapCode(body));
    } catch {
      return fail("unsupported");
    }
  }

  async function decodeRing(code: string): Promise<Result<ShareCodePayload, CodecError>> {
    try {
      // 1. framing and size
      const extracted = extractBody(String(code));
      if (!extracted.ok) return extracted;
      const raw = base64urlDecode(extracted.value);
      if (raw === null || raw.length < HEADER_BYTES + TAG_BYTES) return fail("malformed");

      // 2. version and key
      if (raw[0] !== CODE_VERSION) return fail("unsupported");
      const header = raw.slice(0, 1 + KEY_ID_BYTES);
      const keyId = toHex(raw.slice(1, 1 + KEY_ID_BYTES));
      const key = keys.byId(keyId);
      if (key === null || key.secret.length !== KEY_BYTES) return fail("unsupported");
      const subtle = cryptoOrNull()?.subtle;
      if (!subtle) return fail("unsupported");

      // 3. authentication
      const iv = raw.slice(1 + KEY_ID_BYTES, HEADER_BYTES);
      let plain: Uint8Array;
      try {
        const aesKey = await subtle.importKey("raw", key.secret, { name: "AES-GCM" }, false, [
          "encrypt",
          "decrypt",
        ]);
        plain = new Uint8Array(
          await subtle.decrypt(
            { name: "AES-GCM", iv, additionalData: header },
            aesKey,
            raw.slice(HEADER_BYTES),
          ),
        );
      } catch {
        return fail("tampered");
      }

      // 4. content
      let inflated: Uint8Array | null;
      try {
        inflated = inflateCapped(plain);
      } catch {
        return fail("tooLarge");
      }
      if (inflated === null) return fail("malformed");
      const json = utf8Decode(inflated);
      if (json === null) return fail("malformed");
      // A JSON error lands in the outer catch: malformed.
      const payload = parseShareCodePayload(JSON.parse(json));
      if (!payload.ok || payload.value.keyId !== keyId) return fail("malformed");

      // 5. lifetime (an unparseable date counts as not expired, as for ring expiry)
      const expiresAt = Date.parse(payload.value.expiresAt ?? "");
      if (!Number.isNaN(expiresAt) && expiresAt < now().getTime()) return fail("expired");
      return ok(payload.value);
    } catch {
      return fail("malformed");
    }
  }

  return { encodeRing, decodeRing };
}
