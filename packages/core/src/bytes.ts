// Small byte helpers shared by the codec, the licence check and the heartbeat. Pure JavaScript: the
// send-time runtime may lack `TextDecoder`, `btoa` and friends, so nothing here depends on them.

const HEX = "0123456789abcdef";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += HEX.charAt(b >> 4) + HEX.charAt(b & 15);
  return out;
}

/** Bytes of a lower- or upper-case hex string, or null when it is not valid hex of even length. */
export function fromHex(text: string): Uint8Array | null {
  if (text.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(text)) return null;
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(text.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Base64url without padding. */
export function base64urlEncode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63);
    if (i + 1 < bytes.length) out += B64.charAt((n >> 6) & 63);
    if (i + 2 < bytes.length) out += B64.charAt(n & 63);
  }
  return out;
}

/**
 * Bytes of a base64url string without padding, or null when it holds a character outside the
 * alphabet, has an impossible length, or has non-zero leftover bits (a second spelling of the
 * same bytes would let a code be altered without changing what it decodes to).
 */
export function base64urlDecode(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let at = 0;
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at] = (acc >> bits) & 255;
      at += 1;
      acc &= (1 << bits) - 1;
    }
  }
  return acc === 0 ? out : null;
}

/**
 * Strict UTF-8 decoding: null for any invalid sequence (overlong forms, surrogates, values above
 * U+10FFFF, truncated sequences). Hand-written for the same reason as `utf8` in hash.ts.
 */
export function utf8Decode(bytes: Uint8Array): string | null {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i] ?? 0;
    let cp: number;
    let extra: number;
    let min: number;
    if (b0 < 0x80) {
      cp = b0;
      extra = 0;
      min = 0;
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      cp = b0 & 0x1f;
      extra = 1;
      min = 0x80;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      cp = b0 & 0x0f;
      extra = 2;
      min = 0x800;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      cp = b0 & 0x07;
      extra = 3;
      min = 0x10000;
    } else return null;
    for (let k = 1; k <= extra; k += 1) {
      const bk = bytes[i + k];
      if (bk === undefined || (bk & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (bk & 0x3f);
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    out += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return out;
}
