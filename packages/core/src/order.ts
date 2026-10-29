// Recipient ordering (FR-3). Rank is the index of the first matching pattern; recipients that
// match nothing go last in their original order, unless a `*` pattern places them (FR-3.3).
import type { ShadowWarning } from "./api";
import { compileMember, isStrictSubdomain, matchCompiled, type CompiledMember } from "./match";
import {
  err,
  ok,
  type ComposeSnapshot,
  type FieldName,
  type Mutation,
  type RecipientEntry,
  type Result,
  type Ring,
} from "./model";
import { splitAddress } from "./normalize";

const REST = "*";
const FIELDS: readonly FieldName[] = ["to", "cc", "bcc"];

/** `rest` is the `*` group; the other kinds reuse the member grammar (address, domain, `*.domain`). */
export type OrderPattern = { readonly kind: "rest" } | CompiledMember;

/** Parses one order entry. Unparseable entries yield null and match nothing. */
export function parsePattern(raw: string): OrderPattern | null {
  const text = raw.trim();
  if (text === REST) return { kind: "rest" };
  if (text.startsWith("*.")) return compileMember({ kind: "subdomains", value: text });
  return compileMember({ kind: text.includes("@") ? "address" : "domain", value: text });
}

const matches = (pattern: OrderPattern | null, entry: RecipientEntry): boolean => {
  if (pattern === null) return false;
  if (pattern.kind === "rest") return true;
  const parsed = splitAddress(entry.address);
  return parsed.ok && matchCompiled(pattern, parsed.value);
};

/** Index of the first matching pattern, or `patterns.length` when none matches. */
export function rankRecipient(patterns: readonly (OrderPattern | null)[], entry: RecipientEntry) {
  const first = patterns.findIndex((p) => matches(p, entry));
  return first < 0 ? patterns.length : first;
}

/** Stable sort of one field. Does not mutate the input; an empty list keeps the order. */
export function sortField(order: readonly string[], entries: readonly RecipientEntry[]) {
  const patterns = order.map(parsePattern);
  return entries
    .map((entry, position) => ({ entry, position, rank: rankRecipient(patterns, entry) }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((x) => x.entry);
}

type Fields = Readonly<Record<FieldName, readonly RecipientEntry[]>>;

const keyOf = (e: RecipientEntry) => JSON.stringify([e.address, e.displayName]);

/** Same recipients (address and display name, duplicates counted) regardless of order. */
export function sameMultiset(a: readonly RecipientEntry[], b: readonly RecipientEntry[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const e of a) counts.set(keyOf(e), (counts.get(keyOf(e)) ?? 0) + 1);
  for (const e of b) {
    const left = counts.get(keyOf(e));
    if (left === undefined || left === 0) return false;
    counts.set(keyOf(e), left - 1);
  }
  return true;
}

/** FR-3.6: same multiset in each field, so nothing was added, dropped, renamed or moved across. */
export const sameRecipients = (before: Fields, after: Fields): boolean =>
  FIELDS.every((field) => sameMultiset(before[field], after[field]));

export interface InvariantViolation {
  readonly code: "multisetChanged";
  readonly field: FieldName;
}

export type FieldSorter = (
  order: readonly string[],
  entries: readonly RecipientEntry[],
) => readonly RecipientEntry[];

/**
 * Mutations that bring each field into ring order, verified against the FR-3.6 invariant. The
 * sorter is injectable so tests can prove a corrupt sorter is rejected.
 */
export function sortRecipientsChecked(
  ring: Pick<Ring, "order">,
  snapshot: Pick<ComposeSnapshot, FieldName>,
  sorter: FieldSorter = sortField,
): Result<Mutation[], InvariantViolation> {
  const mutations: Mutation[] = [];
  for (const field of FIELDS) {
    const entries = snapshot[field];
    const sorted = sorter(ring.order[field], entries);
    if (!sameMultiset(entries, sorted)) {
      return err({ code: "multisetChanged", field });
    }
    if (sorted.some((e, i) => e !== entries[i])) mutations.push({ field, entries: [...sorted] });
  }
  return ok(mutations);
}

/**
 * Contract-shaped function over a given sorter: no mutations when the invariant would break, so a
 * sorting bug can never alter the mail or block sending.
 */
export const createSortRecipients =
  (sorter: FieldSorter) =>
  (ring: Ring, snapshot: ComposeSnapshot): readonly Mutation[] => {
    const result = sortRecipientsChecked(ring, snapshot, sorter);
    return result.ok ? result.value : [];
  };

export const sortRecipients = createSortRecipients(sortField);

// Values of different kinds never collide: only addresses contain "@".
const covers = (earlier: OrderPattern, later: OrderPattern): boolean => {
  if (earlier.kind === "rest") return true;
  if (later.kind === "rest") return false;
  switch (earlier.kind) {
    case "address":
      return later.value === earlier.value;
    case "domain":
      return (
        (later.kind === "domain" && later.value === earlier.value) ||
        later.value.endsWith(`@${earlier.value}`)
      );
    case "subdomains":
      return (
        (later.kind === "subdomains" && later.value === earlier.value) ||
        isStrictSubdomain(later.value.slice(later.value.indexOf("@") + 1), earlier.value)
      );
  }
};

/** FR-3.4: patterns that can never be used because an earlier pattern already catches them. */
export function findShadowedPatterns(order: readonly string[]): ShadowWarning[] {
  const items = order.map((raw) => ({ raw, pattern: parsePattern(raw) }));
  const out: ShadowWarning[] = [];
  items.forEach((later, j) => {
    const { pattern } = later;
    if (pattern === null) return;
    const by = items.slice(0, j).find((x) => x.pattern !== null && covers(x.pattern, pattern));
    if (by !== undefined) out.push({ shadowed: later.raw, by: by.raw });
  });
  return out;
}
