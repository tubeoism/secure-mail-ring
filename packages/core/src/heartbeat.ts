// Installation-coverage heartbeat (D-17, NFR-3, R-18). Once a day the add-in sends one small record
// so that the owner can tell how many of the target users have it. The record holds a salted hash
// of the mailbox and two version strings, nothing else: no recipient, subject, file name or ring.
// The caller sends it; this module builds and validates it. The Worker (AG-12) validates incoming
// records with the same schema.
import * as v from "valibot";
import { toHex } from "./bytes";
import { sha256, utf8 } from "./hash";
import { normalizeAddress } from "./normalize";
import { err, ok, type Result } from "./model";

// A version is dotted numbers with an optional short build tag, so that no name or address can be
// smuggled in as a "version": 1, 1.0.0, 2026.11.05+build.7.
const VERSION = /^(?=.{1,32}$)\d+(?:\.\d+){0,3}(?:\+[0-9A-Za-z.]{1,16})?$/;

export const HeartbeatPayloadSchema = v.strictObject({
  /** Hex SHA-256 of the salt and the normalised mailbox address. */
  h: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  bundle: v.pipe(v.string(), v.regex(VERSION)),
  manifest: v.pipe(v.string(), v.regex(VERSION)),
});

export type HeartbeatPayload = v.InferOutput<typeof HeartbeatPayloadSchema>;

export interface HeartbeatInput {
  readonly mailbox: string;
  readonly salt: string;
  readonly bundleVersion: string;
  readonly manifestVersion: string;
}

export interface HeartbeatError {
  readonly code: "badMailbox" | "badVersion" | "noSalt";
}

/** The salted hash of a mailbox, as the Worker's coverage report computes it for a user list. */
export function hashMailbox(salt: string, mailbox: string): Result<string, HeartbeatError> {
  const address = normalizeAddress(mailbox);
  if (!address.ok) return err({ code: "badMailbox" });
  if (salt === "") return err({ code: "noSalt" });
  return ok(toHex(sha256(utf8(`${salt}\u0000${address.value}`))));
}

export function buildHeartbeat(input: HeartbeatInput): Result<HeartbeatPayload, HeartbeatError> {
  const h = hashMailbox(input.salt, input.mailbox);
  if (!h.ok) return h;
  if (!VERSION.test(input.bundleVersion) || !VERSION.test(input.manifestVersion)) {
    return err({ code: "badVersion" });
  }
  return ok({ h: h.value, bundle: input.bundleVersion, manifest: input.manifestVersion });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True once a day. A missing or unreadable date sends; a date more than a day ahead (clock moved back) sends. */
export function shouldSendHeartbeat(lastSentAt: string | null, now: Date): boolean {
  if (lastSentAt === null) return true;
  const last = Date.parse(lastSentAt);
  if (Number.isNaN(last)) return true;
  const elapsed = now.getTime() - last;
  return elapsed >= DAY_MS || elapsed < -DAY_MS;
}
