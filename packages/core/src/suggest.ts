// Ring suggestion for a mail that has none (E-3, decision D-05). Only recipients outside the
// sender's domain count: colleagues belong to every engagement and say nothing about which one.
// A tie suggests nothing, because a wrong suggestion is worse than none.
import { isRingExpired } from "./expiry";
import { createMemberIndex } from "./match";
import type { ComposeSnapshot, FieldName, Ring } from "./model";
import { splitAddress } from "./normalize";

const FIELDS: readonly FieldName[] = ["to", "cc", "bcc"];

/** Distinct normalised addresses of recipients outside the sender's domain. */
export function externalAddresses(snapshot: Pick<ComposeSnapshot, "from" | FieldName>): string[] {
  const sender = splitAddress(snapshot.from);
  const found = new Set<string>();
  for (const field of FIELDS) {
    for (const entry of snapshot[field]) {
      const parsed = splitAddress(entry.address);
      if (!parsed.ok) continue;
      if (sender.ok && sender.value.domain === parsed.value.domain) continue;
      found.add(`${parsed.value.local}@${parsed.value.domain}`);
    }
  }
  return [...found];
}

export function createSuggestRing(now: () => Date) {
  return function suggestRing(
    rings: readonly Pick<Ring, "id" | "members" | "expiresAt">[],
    snapshot: Pick<ComposeSnapshot, "from" | FieldName>,
  ): string | null {
    const at = now();
    const addresses = externalAddresses(snapshot);
    let best: { id: string; score: number } | null = null;
    let tied = false;
    for (const ring of rings) {
      if (isRingExpired(ring, at)) continue;
      const index = createMemberIndex(ring.members);
      const score = addresses.filter((a) => index.find(a) !== undefined).length;
      if (score === 0) continue;
      if (best === null || score > best.score) {
        best = { id: ring.id, score };
        tied = false;
      } else if (score === best.score) {
        tied = true;
      }
    }
    return best === null || tied ? null : best.id;
  };
}
