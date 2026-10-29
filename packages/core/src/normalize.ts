// Address and domain normalisation (FR-1.2). Pure ES2022: no URL, no Intl, no Node, because the
// send-time runtime on classic Outlook has no DOM. Internationalised labels are compared in their
// punycode form so that a Cyrillic look-alike never equals its Latin twin.
import { err, ok, type Result } from "./model";

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

const MAX_ADDRESS = 254;
const MAX_LABEL = 63;
const ACE_PREFIX = "xn--";

const digit = (d: number) => String.fromCharCode(d < 26 ? d + 97 : d + 22);

function adapt(delta: number, points: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / points);
  let k = 0;
  while (d > ((BASE - T_MIN) * T_MAX) / 2) {
    d = Math.floor(d / (BASE - T_MIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - T_MIN + 1) * d) / (d + SKEW));
}

/** RFC 3492 encoder for one label, without the `xn--` prefix. */
export function punycodeEncode(input: string): string {
  const points = Array.from(input, (c) => c.codePointAt(0) ?? 0);
  const basic = points.filter((c) => c < 128);
  let out = basic.map((c) => String.fromCharCode(c)).join("");
  const basicCount = basic.length;
  let handled = basicCount;
  if (basicCount > 0) out += "-";
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  while (handled < points.length) {
    let next = Infinity;
    for (const c of points) if (c >= n && c < next) next = c;
    delta += (next - n) * (handled + 1);
    n = next;
    for (const c of points) {
      if (c < n) delta += 1;
      if (c !== n) continue;
      let q = delta;
      for (let k = BASE; ; k += BASE) {
        const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
        if (q < t) break;
        out += digit(t + ((q - t) % (BASE - t)));
        q = Math.floor((q - t) / (BASE - t));
      }
      out += digit(q);
      bias = adapt(delta, handled + 1, handled === basicCount);
      delta = 0;
      handled += 1;
    }
    delta += 1;
    n += 1;
  }
  return out;
}

const isAscii = (s: string) => {
  for (let i = 0; i < s.length; i += 1) if (s.charCodeAt(i) > 127) return false;
  return true;
};

/** NFC, lower case, then NFC again because lower-casing can denormalise. */
export const canonicalText = (s: string): string =>
  s.normalize("NFC").toLowerCase().normalize("NFC");

/** One DNS label to its comparison form: canonical text, punycode when not ASCII. */
export function toAsciiLabel(label: string): string {
  const canonical = canonicalText(label);
  return isAscii(canonical) ? canonical : ACE_PREFIX + punycodeEncode(canonical);
}

export interface AddressError {
  readonly code: "empty" | "noAt" | "multipleAt" | "emptyPart" | "tooLong" | "badLabel";
}

export interface ParsedAddress {
  /** Canonical (NFC, lower-case) local part. */
  readonly local: string;
  /** Domain in comparison form: lower-case ASCII labels, trailing dot removed. */
  readonly domain: string;
}

/** Labels of a normalised domain, right to left (`mail.abccorp.vn` gives `vn`, `abccorp`, `mail`). */
export const domainLabels = (domain: string): string[] => domain.split(".").reverse();

/** Normalises a domain; fails on empty labels or labels over 63 octets. */
export function normalizeDomain(raw: string): Result<string, AddressError> {
  const trimmed = raw.trim();
  const bare = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  if (bare === "") return err({ code: "emptyPart" });
  const labels: string[] = [];
  for (const label of bare.split(".")) {
    if (label === "" || /[\s@]/.test(label)) return err({ code: "badLabel" });
    const ascii = toAsciiLabel(label);
    if (ascii.length > MAX_LABEL) return err({ code: "badLabel" });
    labels.push(ascii);
  }
  return ok(labels.join("."));
}

/** Splits `local@domain` and normalises both halves. Never throws. */
export function splitAddress(raw: string): Result<ParsedAddress, AddressError> {
  const trimmed = raw.trim();
  if (trimmed === "") return err({ code: "empty" });
  if (trimmed.length > MAX_ADDRESS) return err({ code: "tooLong" });
  const at = trimmed.indexOf("@");
  if (at < 0) return err({ code: "noAt" });
  if (trimmed.indexOf("@", at + 1) >= 0) return err({ code: "multipleAt" });
  const local = canonicalText(trimmed.slice(0, at));
  const domain = normalizeDomain(trimmed.slice(at + 1));
  if (local === "") return err({ code: "emptyPart" });
  if (!domain.ok) return domain;
  if (local.length + 1 + domain.value.length > MAX_ADDRESS) return err({ code: "tooLong" });
  return ok({ local, domain: domain.value });
}

/** Canonical `local@domain`. Idempotent: normalising a normalised address returns it unchanged. */
export function normalizeAddress(raw: string): Result<string, AddressError> {
  const parsed = splitAddress(raw);
  return parsed.ok ? ok(`${parsed.value.local}@${parsed.value.domain}`) : parsed;
}
