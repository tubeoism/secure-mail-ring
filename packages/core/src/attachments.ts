// Attachment name checks (FR-4). Only names are read, never contents (FR-4.8). Matching is
// boundary-aware: `ABC` matches `x_ABC.pdf` and `[ABC] x.pdf` but not `ABCD_x.pdf`.
import { isRingExpired } from "./expiry";
import type { AttachmentInfo, Ring } from "./model";

const COMBINING_MARKS = /[̀-ͯ]/g;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** NFC, lower case, then strip diacritics (decision D2); `đ` has no decomposition so it is mapped. */
export function foldForMatch(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d");
}

const isWordChar = (ch: string | undefined) => ch !== undefined && LETTER_OR_DIGIT.test(ch);

/**
 * True when `token` occurs in `fileName` with a boundary on each side that starts or ends with a
 * letter or digit. A token edge that is itself punctuation (`-IA`) needs no further boundary.
 */
export function tokenMatches(token: string, fileName: string): boolean {
  const needle = Array.from(foldForMatch(token.trim()));
  if (needle.length === 0) return false;
  const hay = Array.from(foldForMatch(fileName));
  const first = needle[0];
  const last = needle[needle.length - 1];
  for (let i = 0; i + needle.length <= hay.length; i += 1) {
    if (!needle.every((ch, k) => hay[i + k] === ch)) continue;
    const gluedBefore = isWordChar(first) && isWordChar(hay[i - 1]);
    const gluedAfter = isWordChar(last) && isWordChar(hay[i + needle.length]);
    if (!gluedBefore && !gluedAfter) return true;
  }
  return false;
}

export type AttachmentStatus = "ok" | "missingToken" | "foreignRingToken";

export interface AttachmentCheck {
  readonly attachment: AttachmentInfo;
  readonly status: AttachmentStatus;
  /** Ids of other rings whose tokens the name carries; set only for `foreignRingToken`. */
  readonly foreignRingIds: readonly string[];
}

type RingTokens = Pick<Ring, "id" | "attachments"> & Partial<Pick<Ring, "expiresAt">>;

const hasExtension = (name: string, extensions: readonly string[]) => {
  const lower = name.toLowerCase();
  return extensions.some((ext) => {
    const e = ext.trim().toLowerCase();
    return e !== "" && lower.endsWith(e.startsWith(".") ? e : `.${e}`);
  });
};

const hasAny = (tokens: readonly string[], name: string) =>
  tokens.some((t) => tokenMatches(t, name));

/**
 * Per attachment: `foreignRingToken` when the name carries another ring's token and none of the
 * current ring's (FR-4.3); `missingToken` when the ring has tokens and none matches; else `ok`.
 * Tokens the ring shares with another ring are not foreign; expired rings are ignored (D3).
 */
export function checkAttachments(
  ring: RingTokens,
  otherRings: readonly RingTokens[],
  attachments: readonly AttachmentInfo[],
  now: Date,
): AttachmentCheck[] {
  const own = ring.attachments.tokens;
  const ownFolded = new Set(own.map((t) => foldForMatch(t.trim())));
  const foreign = otherRings
    .filter((r) => r.id !== ring.id && !isRingExpired(r, now))
    .map((r) => ({
      id: r.id,
      tokens: r.attachments.tokens.filter((t) => !ownFolded.has(foldForMatch(t.trim()))),
    }));
  return attachments.map((attachment) => {
    const done = (status: AttachmentStatus, foreignRingIds: readonly string[] = []) => ({
      attachment,
      status,
      foreignRingIds,
    });
    const name = attachment.name;
    if (attachment.isInline && ring.attachments.ignoreInline) return done("ok");
    if (hasExtension(name, ring.attachments.exemptExtensions)) return done("ok");
    if (hasAny(own, name)) return done("ok");
    const foreignIds = foreign.filter((r) => hasAny(r.tokens, name)).map((r) => r.id);
    if (foreignIds.length > 0) return done("foreignRingToken", foreignIds);
    return done(own.length > 0 ? "missingToken" : "ok");
  });
}
