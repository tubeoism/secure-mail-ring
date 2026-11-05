// Share codes made by the real codec with the development keys (contract-v2), for the export and
// import screens. Unlike `shareCodes` (canned strings for the stub) these decode with `core` from
// `../core`. Built on demand because encryption is asynchronous and every code gets a fresh IV.
import {
  BEGIN_MARKER,
  END_MARKER,
  MAX_BODY_CHARS,
  createCodec,
  type CodecError,
  type Ring,
} from "@smr/core";
import { devKeys, foreignDevKeys } from "../devKeys";
import { rings } from "./index";

export interface LiveShareCodes {
  readonly ring: Ring;
  readonly issuer: string;
  /** Decodes to `ring`. */
  readonly valid: string;
  /** The same code with spaces, line breaks and invisible characters inserted (chat tools). */
  readonly spaced: string;
  /** The same code inside a quoted reply. */
  readonly quoted: string;
  /** One character of the body changed. */
  readonly tampered: string;
  /** Made with an `expiresAt` in the past. */
  readonly expired: string;
  /** A body above the size limit. */
  readonly oversize: string;
  /** Made with a key the dev keys do not know. */
  readonly foreignKey: string;
}

/** The error each broken fixture must give when decoded. */
export const LIVE_SHARE_CODE_ERRORS: Readonly<
  Record<"tampered" | "expired" | "oversize" | "foreignKey", CodecError["code"]>
> = { tampered: "tampered", expired: "expired", oversize: "tooLarge", foreignKey: "unsupported" };

const ZWSP = String.fromCharCode(0x200b);
const NBSP = String.fromCharCode(0xa0);
const ISSUER = "an.nguyen@auditfirm.vn";
const ISSUED_AT = "2026-11-05T08:00:00Z";

export async function buildLiveShareCodes(): Promise<LiveShareCodes> {
  const ring = rings[0];
  if (ring === undefined) throw new Error("fixtures have no ring");
  const meta = { issuer: ISSUER, issuedAt: ISSUED_AT };
  const codec = createCodec({ keys: devKeys });
  const make = async (c: ReturnType<typeof createCodec>, extra: { expiresAt?: string } = {}) => {
    const r = await c.encodeRing(ring, { ...meta, ...extra });
    if (!r.ok) throw new Error(`cannot build a share-code fixture: ${r.error.code}`);
    return r.value;
  };
  const valid = await make(codec);
  const lines = valid.split("\n");
  const body = lines.slice(1, -1).join("");
  const at = Math.floor(body.length / 2);
  const flipped = body.charAt(at) === "A" ? "B" : "A";
  return {
    ring,
    issuer: ISSUER,
    valid,
    spaced: valid.replace(/\n/g, ` \r\n${ZWSP} `).replace(/(.{20})/, `$1${NBSP}`),
    quoted: lines.map((l) => `> ${l}`).join("\r\n"),
    tampered: `${BEGIN_MARKER}\n${body.slice(0, at)}${flipped}${body.slice(at + 1)}\n${END_MARKER}`,
    expired: await make(codec, { expiresAt: "2020-01-01T00:00:00Z" }),
    oversize: `${BEGIN_MARKER}\n${"A".repeat(MAX_BODY_CHARS + 1)}\n${END_MARKER}`,
    foreignKey: await make(createCodec({ keys: foreignDevKeys })),
  };
}
