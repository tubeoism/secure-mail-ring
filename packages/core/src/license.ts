// Licence check (plan section 6.3, D-12, CL-05B). The add-in is built for one organisation: the
// sender's domain must be one the build knows, held only as salted hashes. v1 is tier 2
// (`BuildTimeDomainProvider`); `LicenseProvider` leaves room for a tenant check (tier 3) without
// changing callers.
//
// The result takes part in the data flow, not only in a branch: the key of the share-code codec is
// derived from it, so a build that patches the check out still cannot read or write codes. A
// licence failure never blocks sending a mail (AGENTS.md section 8, fail-open); it disables share
// and import and is reported through `reason`.
import { concatBytes, toHex } from "./bytes";
import type { KeyMaterial, KeyProvider } from "./codec";
import { keyIdOf } from "./codec";
import { sha256, utf8 } from "./hash";
import { splitAddress } from "./normalize";

export type LicenseReason = "ok" | "invalidProfile" | "noList" | "notListed";

export interface LicenseProfile {
  /** The signed-in mailbox address (Office.js user profile). */
  readonly emailAddress: string;
}

export interface LicenseResult {
  readonly licensed: boolean;
  readonly reason: LicenseReason;
  /** 32 bytes derived from the matched domain, or null when not licensed. */
  readonly keyPart: Uint8Array | null;
}

export interface LicenseProvider {
  check(profile: LicenseProfile): LicenseResult;
}

export interface BuildTimeDomainOptions {
  /** Salt for the domain hashes; injected at build time. */
  readonly salt: string;
  /** Allowed domains as hex SHA-256 of `salt`, a zero byte and the normalised domain. */
  readonly domainHashes: readonly string[];
}

const NOT_LICENSED = (reason: Exclude<LicenseReason, "ok">): LicenseResult => ({
  licensed: false,
  reason,
  keyPart: null,
});

/** The value stored in the build for one allowed domain. */
export function hashDomain(salt: string, domain: string): string {
  return toHex(sha256(utf8(`${salt}\u0000${domain}`)));
}

export function createBuildTimeDomainProvider(options: BuildTimeDomainOptions): LicenseProvider {
  const allowed = new Set(options.domainHashes.map((h) => h.toLowerCase()));
  return {
    check(profile) {
      const address = splitAddress(
        typeof profile?.emailAddress === "string" ? profile.emailAddress : "",
      );
      if (!address.ok) return NOT_LICENSED("invalidProfile");
      if (allowed.size === 0) return NOT_LICENSED("noList");
      const hash = hashDomain(options.salt, address.value.domain);
      if (!allowed.has(hash)) return NOT_LICENSED("notListed");
      return {
        licensed: true,
        reason: "ok",
        keyPart: sha256(utf8(`${options.salt}\u0000key\u0000${address.value.domain}`)),
      };
    },
  };
}

export interface LicensedKeysOptions {
  /** Organisation secrets, newest first. Only the first writes; all can read (key rotation). */
  readonly orgSecrets: readonly Uint8Array[];
  readonly license: LicenseResult;
}

/**
 * Keys for the codec, each derived from an organisation secret and the licence result. An
 * unlicensed result yields no key at all.
 */
export function createLicensedKeyProvider({
  orgSecrets,
  license,
}: LicensedKeysOptions): KeyProvider {
  const keys: KeyMaterial[] =
    license.licensed && license.keyPart !== null
      ? orgSecrets.map((secret) => {
          const derived = sha256(
            concatBytes(secret, Uint8Array.of(0), license.keyPart as Uint8Array),
          );
          return { keyId: keyIdOf(derived), secret: derived };
        })
      : [];
  return {
    current: () => keys[0] ?? null,
    byId: (keyId) => keys.find((k) => k.keyId === keyId) ?? null,
  };
}
