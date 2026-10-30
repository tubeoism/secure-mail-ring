// Look-alike domain detection (F6, FR-6.1 to 6.5). A recipient domain that is not itself a trusted
// domain is flagged when it resembles one: same skeleton after mapping confusable characters,
// same name apart from hyphens, same name under another suffix, or one or two typos away.
// The confusable table is a curated subset of UTS #39 (CL-04 Q3), not the full data file.
import { compileMember } from "./match";
import type { ComposeSnapshot, FieldName, GlobalSettings, RecipientEntry, Ring } from "./model";
import { normalizeDomain, punycodeDecode, splitAddress } from "./normalize";

const ACE_PREFIX = "xn--";
const FIELDS: readonly FieldName[] = ["to", "cc", "bcc"];
/** Second levels that sit under a two-letter country code (`com.vn`, `co.uk`, `ac.jp`). */
const GENERIC_SECOND_LEVEL = new Set([
  "com",
  "net",
  "org",
  "gov",
  "edu",
  "ac",
  "co",
  "or",
  "ne",
  "go",
]);
const MIN_LABEL_FOR_DISTANCE = 4;
const SHORT_LABEL = 8;

export interface Registrable {
  /** The registrable name without its suffix: `abccorp` in `mail.abccorp.com.vn`. */
  readonly primary: string;
  readonly suffix: string;
  /** `primary` joined to `suffix`. */
  readonly domain: string;
}

/** Splits a normalised domain into primary label and suffix (heuristic, no public suffix list). */
export function splitRegistrable(domain: string): Registrable {
  const labels = domain.split(".");
  const last = labels[labels.length - 1] ?? "";
  const second = labels[labels.length - 2] ?? "";
  if (labels.length === 1) return { primary: last, suffix: "", domain: last };
  const twoPartSuffix = labels.length >= 3 && last.length === 2 && GENERIC_SECOND_LEVEL.has(second);
  const suffixLength = twoPartSuffix ? 2 : 1;
  const primary = labels[labels.length - suffixLength - 1] ?? "";
  const suffix = labels.slice(labels.length - suffixLength).join(".");
  return { primary, suffix, domain: `${primary}.${suffix}` };
}

const CONFUSABLES: ReadonlyMap<string, string> = new Map(
  Object.entries({
    "0": "o",
    "1": "l",
    // Cyrillic
    а: "a",
    е: "e",
    о: "o",
    р: "p",
    с: "c",
    у: "y",
    х: "x",
    і: "i",
    ј: "j",
    ѕ: "s",
    ԁ: "d",
    һ: "h",
    ԛ: "q",
    ԝ: "w",
    ӏ: "l",
    // Greek
    ο: "o",
    ν: "v",
    ρ: "p",
    // Latin extensions
    ı: "i",
    ɑ: "a",
    ɡ: "g",
    đ: "d",
    ł: "l",
    ø: "o",
  }),
);

const COMBINING_MARKS = /[̀-ͯ]/g;

/** The Unicode form of a label: `xn--` labels are decoded, anything undecodable stays as is. */
export function labelView(label: string): string {
  if (!label.startsWith(ACE_PREFIX)) return label;
  return punycodeDecode(label.slice(ACE_PREFIX.length)) ?? label;
}

/** UTS #39 style skeleton of a label: equal skeletons mean visually confusable names. */
export function skeleton(label: string): string {
  const folded = labelView(label).normalize("NFKD").toLowerCase().replace(COMBINING_MARKS, "");
  let mapped = "";
  for (const ch of folded) mapped += CONFUSABLES.get(ch) ?? ch;
  return mapped.replace(/rn/g, "m").replace(/vv/g, "w");
}

/** True when the Damerau-Levenshtein (optimal string alignment) distance is at most `max`. */
export function withinDistance(a: string, b: string, max: number): boolean {
  return withinDistanceOf(Array.from(a), Array.from(b), max);
}

function withinDistanceOf(x: readonly string[], y: readonly string[], max: number): boolean {
  if (Math.abs(x.length - y.length) > max) return false;
  let previous: number[] = [];
  let current: number[] = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const older = previous;
    previous = current;
    current = [i];
    let rowMin = i;
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      let d = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        d = Math.min(d, (older[j - 2] ?? 0) + 1);
      }
      current.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return false;
  }
  return (current[y.length] ?? Infinity) <= max;
}

export type LookalikeRule = "skeleton" | "hyphen" | "suffix" | "editDistance";
export type ReferenceSource = "ring" | "internal" | "otherRing";

export interface LookalikeReference {
  /** Registrable domain of the trusted domain. */
  readonly domain: string;
  readonly source: ReferenceSource;
  /** Ring the domain comes from; null for the sender's own domain. */
  readonly ringId: string | null;
}

export interface LookalikeMatch {
  readonly field: FieldName;
  readonly entry: RecipientEntry;
  /** Registrable domain of the recipient. */
  readonly domain: string;
  readonly reference: LookalikeReference;
  readonly rule: LookalikeRule;
}

const stripHyphens = (label: string) => label.replace(/-/g, "");

/** Edit-distance limit for two labels (FR-6.2 a); very short names are exempt (CL-04 Q3). */
function typoLimit(a: number, b: number): number {
  if (Math.min(a, b) < MIN_LABEL_FOR_DISTANCE) return 0;
  return Math.max(a, b) <= SHORT_LABEL ? 1 : 2;
}

type RingDomains = Pick<Ring, "id" | "members"> & Partial<Pick<Ring, "expiresAt">>;

export interface LookalikeInput {
  /** The ring bound to the mail, or null (FR-6.5). */
  readonly ring: RingDomains | null;
  /** Every ring on the device, including the bound one. */
  readonly rings: readonly RingDomains[];
  readonly snapshot: Pick<ComposeSnapshot, "from" | FieldName>;
  readonly exceptions: GlobalSettings["lookalikeExceptions"];
  readonly now: Date;
}

const isExpired = (ring: RingDomains, now: Date) => {
  if (ring.expiresAt == null) return false;
  const at = Date.parse(ring.expiresAt);
  return !Number.isNaN(at) && at < now.getTime();
};

const memberDomain = (member: RingDomains["members"][number]): string | null => {
  const compiled = compileMember(member);
  // An address value carries its domain after "@"; other kinds have no "@" and keep the whole value.
  return compiled === null ? null : compiled.value.slice(compiled.value.indexOf("@") + 1);
};

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function exceptionKeys(exceptions: LookalikeInput["exceptions"]): Set<string> {
  const keys = new Set<string>();
  const registrable = (raw: string) => {
    const domain = normalizeDomain(raw.slice(raw.lastIndexOf("@") + 1));
    return domain.ok ? splitRegistrable(domain.value).domain : null;
  };
  for (const { a, b } of exceptions) {
    const left = registrable(a);
    const right = registrable(b);
    if (left !== null && right !== null) keys.add(pairKey(left, right));
  }
  return keys;
}

function collectReferences(input: LookalikeInput): Map<string, LookalikeReference> {
  const refs = new Map<string, LookalikeReference>();
  const add = (domain: string | null, source: ReferenceSource, ringId: string | null) => {
    if (domain === null) return;
    const key = splitRegistrable(domain).domain;
    if (!refs.has(key)) refs.set(key, { domain: key, source, ringId });
  };
  const addRing = (ring: RingDomains, source: ReferenceSource) => {
    for (const member of ring.members) add(memberDomain(member), source, ring.id);
  };
  if (input.ring !== null) addRing(input.ring, "ring");
  const sender = splitAddress(input.snapshot.from);
  if (sender.ok) add(sender.value.domain, "internal", null);
  for (const ring of input.rings) {
    if (ring.id !== input.ring?.id && !isExpired(ring, input.now)) addRing(ring, "otherRing");
  }
  return refs;
}

interface Indexed {
  readonly ref: LookalikeReference;
  readonly parts: Registrable;
  readonly view: string;
  readonly chars: readonly string[];
}

/** Recipients whose domain resembles a trusted domain without being one. */
export function findLookalikes(input: LookalikeInput): LookalikeMatch[] {
  const refs = collectReferences(input);
  const allowed = exceptionKeys(input.exceptions);
  const indexed: Indexed[] = [...refs.values()].map((ref) => {
    const parts = splitRegistrable(ref.domain);
    const view = labelView(parts.primary);
    return { ref, parts, view, chars: Array.from(view) };
  });
  const bySkeleton = new Map<string, Indexed[]>();
  const byHyphenless = new Map<string, Indexed[]>();
  const byPrimary = new Map<string, Indexed[]>();
  const add = <K>(map: Map<K, Indexed[]>, key: K, item: Indexed) => {
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  };
  for (const item of indexed) {
    add(bySkeleton, skeleton(item.parts.primary), item);
    add(byHyphenless, stripHyphens(item.view), item);
    add(byPrimary, item.parts.primary, item);
  }

  const byLength = new Map<number, Indexed[]>();
  for (const item of indexed) add(byLength, item.chars.length, item);

  const typos = (chars: readonly string[]): Indexed[] => {
    const found: Indexed[] = [];
    for (let length = chars.length - 2; length <= chars.length + 2; length += 1) {
      const limit = typoLimit(chars.length, length);
      if (limit === 0) continue;
      for (const item of byLength.get(length) ?? []) {
        if (withinDistanceOf(chars, item.chars, limit) && item.view !== chars.join(""))
          found.push(item);
      }
    }
    return found;
  };

  const cache = new Map<string, { reference: LookalikeReference; rule: LookalikeRule } | null>();
  const classify = (domain: string) => {
    const parts = splitRegistrable(domain);
    if (refs.has(parts.domain)) return null;
    const view = labelView(parts.primary);
    const rules: readonly (readonly [LookalikeRule, () => readonly Indexed[]])[] = [
      [
        "skeleton",
        () =>
          (bySkeleton.get(skeleton(parts.primary)) ?? []).filter(
            (i) => i.parts.primary !== parts.primary,
          ),
      ],
      ["hyphen", () => (byHyphenless.get(stripHyphens(view)) ?? []).filter((i) => i.view !== view)],
      ["suffix", () => byPrimary.get(parts.primary) ?? []],
      ["editDistance", () => typos(Array.from(view))],
    ];
    for (const [rule, find] of rules) {
      const hit = find().find((i) => !allowed.has(pairKey(parts.domain, i.ref.domain)));
      if (hit) return { reference: hit.ref, rule };
    }
    return null;
  };

  const out: LookalikeMatch[] = [];
  for (const field of FIELDS) {
    for (const entry of input.snapshot[field]) {
      const parsed = splitAddress(entry.address);
      if (!parsed.ok) continue;
      const domain = splitRegistrable(parsed.value.domain).domain;
      if (!cache.has(domain)) cache.set(domain, classify(parsed.value.domain));
      const found = cache.get(domain);
      if (found) out.push({ field, entry, domain, reference: found.reference, rule: found.rule });
    }
  }
  return out;
}
