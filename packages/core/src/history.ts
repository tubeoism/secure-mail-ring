// First-time recipient filter (F7). Two Bloom filter generations of 16,384 bits with 7 hash
// functions; rotation at 1,500 addresses keeps the union near 1 % false positives at 3,000
// addresses (CL-04 D2). Only salted SHA-256 derived bit positions are stored, never addresses.
// A false positive hides a warning; it can never create one.
import { sha256, utf8 } from "./hash";
import type {
  ComposeSnapshot,
  FieldName,
  GlobalSettings,
  HistoryState,
  RecipientEntry,
  Ring,
} from "./model";
import { SCHEMA_ID } from "./model";
import { normalizeAddress, splitAddress } from "./normalize";
import { compileMember } from "./match";

export const FILTER_BITS = 16_384;
export const HASH_COUNT = 7;
/** Addresses per generation before the filter rotates. */
export const GENERATION_CAPACITY = 1_500;
/** Cap for a pasted list of known addresses (two full generations). */
export const MAX_IMPORT = GENERATION_CAPACITY * 2;

const BYTES = FILTER_BITS / 8;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const FIELDS: readonly FieldName[] = ["to", "cc", "bcc"];

/** Base64url without padding; trailing zero bytes are dropped so an empty filter is "". */
function encodeBits(bits: Uint8Array): string {
  let end = bits.length;
  while (end > 0 && bits[end - 1] === 0) end -= 1;
  let out = "";
  for (let i = 0; i < end; i += 3) {
    const n = ((bits[i] ?? 0) << 16) | ((bits[i + 1] ?? 0) << 8) | (bits[i + 2] ?? 0);
    out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63);
    if (i + 1 < end) out += ALPHABET.charAt((n >> 6) & 63);
    if (i + 2 < end) out += ALPHABET.charAt(n & 63);
  }
  return out;
}

/** Inverse of `encodeBits`; invalid input and oversize input give an empty filter, never an error. */
function decodeBits(text: string): Uint8Array {
  const bits = new Uint8Array(BYTES);
  let acc = 0;
  let width = 0;
  let at = 0;
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return new Uint8Array(BYTES);
    acc = (acc << 6) | v;
    width += 6;
    if (width >= 8) {
      width -= 8;
      if (at >= BYTES) return new Uint8Array(BYTES);
      bits[at] = (acc >> width) & 255;
      at += 1;
      acc &= (1 << width) - 1;
    }
  }
  return bits;
}

function positions(salt: string, address: string): number[] {
  const digest = sha256(utf8(`${salt}\u0000${address}`));
  const view = new DataView(digest.buffer);
  const h1 = view.getUint32(0);
  const h2 = view.getUint32(4) | 1;
  return Array.from(
    { length: HASH_COUNT },
    (_, i) => ((h1 + Math.imul(i, h2)) >>> 0) % FILTER_BITS,
  );
}

const has = (bits: Uint8Array, at: readonly number[]) =>
  at.every((p) => ((bits[p >> 3] ?? 0) & (1 << (p & 7))) !== 0);

export function emptyHistory(salt: string): HistoryState {
  return { schema: SCHEMA_ID, salt, current: "", previous: null, count: 0 };
}

export interface HistoryReader {
  /** True when the address was recorded in one of the two generations (or collides with one). */
  has(address: string): boolean;
}

export function openHistory(state: HistoryState): HistoryReader {
  const current = decodeBits(state.current);
  const previous = state.previous === null ? null : decodeBits(state.previous);
  return {
    has(address) {
      const normalized = normalizeAddress(address);
      if (!normalized.ok) return false;
      const at = positions(state.salt, normalized.value);
      return has(current, at) || (previous !== null && has(previous, at));
    },
  };
}

export const mightContain = (state: HistoryState, address: string): boolean =>
  openHistory(state).has(address);

/** Returns a new state with the addresses recorded; invalid and already-known ones are skipped. */
export function recordAddresses(state: HistoryState, addresses: readonly string[]): HistoryState {
  const reader = openHistory(state);
  let current = decodeBits(state.current);
  let previous = state.previous;
  let count = state.count;
  const seen = new Set<string>();
  for (const raw of addresses) {
    const normalized = normalizeAddress(raw);
    if (!normalized.ok || seen.has(normalized.value) || reader.has(normalized.value)) continue;
    seen.add(normalized.value);
    if (count >= GENERATION_CAPACITY) {
      previous = encodeBits(current);
      current = new Uint8Array(BYTES);
      count = 0;
    }
    for (const p of positions(state.salt, normalized.value)) {
      current[p >> 3] = (current[p >> 3] ?? 0) | (1 << (p & 7));
    }
    count += 1;
  }
  return { ...state, current: encodeBits(current), previous, count };
}

const countBits = (bits: Uint8Array) => {
  let ones = 0;
  for (const byte of bits) for (let b = byte; b; b &= b - 1) ones += 1;
  return ones;
};

export interface HistoryStats {
  readonly count: number;
  readonly capacity: number;
  /** Estimated chance that an unseen address reads as known, from the fill of both generations. */
  readonly falsePositiveRate: number;
}

export function historyStats(state: HistoryState): HistoryStats {
  const rate = (bits: Uint8Array) => (countBits(bits) / FILTER_BITS) ** HASH_COUNT;
  const miss =
    (1 - rate(decodeBits(state.current))) *
    (1 - (state.previous === null ? 0 : rate(decodeBits(state.previous))));
  return { count: state.count, capacity: GENERATION_CAPACITY, falsePositiveRate: 1 - miss };
}

/** Extracts normalised, distinct addresses from pasted text (FR-7.3); `skipped` counts the rest. */
export function parseKnownAddresses(text: string): { addresses: string[]; skipped: number } {
  const found = new Set<string>();
  let skipped = 0;
  for (const token of text.split(/[\s,;]+/)) {
    const cleaned = token.replace(/^["'<(]+|[>"')]+$/g, "");
    if (cleaned === "") continue;
    const normalized = normalizeAddress(cleaned);
    if (normalized.ok && found.size < MAX_IMPORT) found.add(normalized.value);
    else skipped += 1;
  }
  return { addresses: [...found], skipped };
}

export interface FirstTimeInput {
  readonly ring: Pick<Ring, "members" | "firstTimeCheck"> | null;
  readonly snapshot: Pick<ComposeSnapshot, FieldName>;
  readonly history: HistoryState;
  readonly settings: Pick<GlobalSettings, "learning">;
  readonly now: Date;
}

export interface FirstTimeRecipient {
  readonly field: FieldName;
  readonly entry: RecipientEntry;
}

/** True while the learning window (FR-7.3) is open: enabled and not yet past `until`. */
export function isLearning(learning: GlobalSettings["learning"], now: Date): boolean {
  if (!learning.enabled) return false;
  if (learning.until === null) return true;
  const until = Date.parse(learning.until);
  return Number.isNaN(until) || now.getTime() < until;
}

/** Recipients never written to before and not declared by address in the ring (FR-7.2). */
export function findFirstTimeRecipients(input: FirstTimeInput): FirstTimeRecipient[] {
  if (input.ring?.firstTimeCheck === false || isLearning(input.settings.learning, input.now))
    return [];
  const declared = new Set<string>();
  for (const member of input.ring?.members ?? []) {
    const compiled = compileMember(member);
    if (compiled?.kind === "address") declared.add(compiled.value);
  }
  const reader = openHistory(input.history);
  const out: FirstTimeRecipient[] = [];
  for (const field of FIELDS) {
    for (const entry of input.snapshot[field]) {
      const parsed = splitAddress(entry.address);
      if (!parsed.ok) continue;
      const address = `${parsed.value.local}@${parsed.value.domain}`;
      if (!declared.has(address) && !reader.has(address)) out.push({ field, entry });
    }
  }
  return out;
}
