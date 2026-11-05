// Fingerprint of what the user is about to send, and the key that binds one acknowledgement to it
// (plan section 3, mode Acknowledge). Order inside a field is irrelevant, so the send-time
// reordering never invalidates a tick; the field is relevant, so moving someone from CC to BCC does.
import { sha256, utf8 } from "./hash";
import type { ComposeSnapshot, FieldName, Finding, Ring } from "./model";
import { canonicalText, splitAddress } from "./normalize";

const FIELDS: readonly FieldName[] = ["to", "cc", "bcc"];
const VERSION = 2;
const KEY_PREFIX = "ak2:";
const KEY_HEX = 32;

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const digest = (parts: unknown): string => hex(sha256(utf8(JSON.stringify(parts))));

/** UTF-16 code unit order: the same on every machine, unlike `localeCompare`. */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function recipientToken(field: FieldName, address: string, displayName: string): string {
  const parsed = splitAddress(address);
  // An unresolved recipient has no usable address; its display name stands in for it. The two
  // shapes carry a tag of their own so that no address can ever equal a name (CL-05C, M-2).
  return parsed.ok
    ? JSON.stringify([field, "a", `${parsed.value.local}@${parsed.value.domain}`])
    : JSON.stringify([field, "u", canonicalText(displayName === "" ? address : displayName)]);
}

export function computeFingerprint(
  ring: Pick<Ring, "id"> | null,
  snapshot: Pick<ComposeSnapshot, FieldName | "attachments">,
): string {
  const recipients = FIELDS.flatMap((field) =>
    snapshot[field].map((e) => recipientToken(field, e.address, e.displayName)),
  ).sort(byCodeUnit);
  const files = snapshot.attachments.map((a) => a.name.normalize("NFC")).sort(byCodeUnit);
  return digest({ v: VERSION, ring: ring?.id ?? null, recipients, files });
}

/** Per-finding key: a changed mail has a new fingerprint, so earlier ticks stop counting. */
export function acknowledgementKey(
  fingerprint: string,
  finding: Pick<Finding, "kind" | "field" | "subject" | "messageKey">,
): string {
  // The message key tells apart findings of one kind that share a subject and field, such as two
  // field rules of different type on the same address (CL-05C, M-1).
  const key = digest([
    fingerprint,
    finding.kind,
    finding.field ?? null,
    finding.subject,
    finding.messageKey,
  ]);
  return KEY_PREFIX + key.slice(0, KEY_HEX);
}
