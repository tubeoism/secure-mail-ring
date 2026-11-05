// Ring expiry (E-8): an engagement that has ended moves its ring to the archive.
import type { Ring } from "./model";

/**
 * True when `expiresAt` parses and lies before `now`. No date, or a date that does not parse,
 * counts as not expired: a broken field must never switch a ring off (fail toward the ring).
 */
export function isRingExpired(ring: Partial<Pick<Ring, "expiresAt">>, now: Date): boolean {
  if (ring.expiresAt == null) return false;
  const at = Date.parse(ring.expiresAt);
  return !Number.isNaN(at) && at < now.getTime();
}
