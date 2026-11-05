import { describe, expect, it } from "vitest";
import { createCodec, keyIdOf } from "../src/codec";
import { sha256, utf8 } from "../src/hash";
import {
  createBuildTimeDomainProvider,
  createLicensedKeyProvider,
  hashDomain,
} from "../src/license";
import { NOW, ring } from "./helpers";

const SALT = "build-salt";
const provider = createBuildTimeDomainProvider({
  salt: SALT,
  domainHashes: [hashDomain(SALT, "abccorp.vn"), hashDomain(SALT, "auditfirm.vn").toUpperCase()],
});
const check = (emailAddress: string) => provider.check({ emailAddress });
const orgSecret = (n: number) => Uint8Array.from({ length: 32 }, (_, i) => (i + n) & 255);
const meta = { issuer: "an@auditfirm.vn", issuedAt: "2026-11-05T08:00:00Z" };

describe("hashDomain", () => {
  it("is a salted SHA-256 in hex", () => {
    expect(hashDomain("s", "abccorp.vn")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDomain("s", "abccorp.vn")).not.toBe(hashDomain("t", "abccorp.vn"));
    expect(hashDomain("s", "abccorp.vn")).not.toBe(hashDomain("s", "abccorp.com"));
    expect(hashDomain("s", "a")).toBe(Buffer.from(sha256(utf8("s\u0000a"))).toString("hex"));
  });
});

describe("BuildTimeDomainProvider", () => {
  it("licenses a mailbox on a listed domain, whatever the case or notation", () => {
    for (const mail of [
      "an@abccorp.vn",
      "AN@ABCCorp.VN",
      "an@abccorp.vn.",
      "  an@abccorp.vn  ",
      "x@AuditFirm.vn",
    ]) {
      expect(check(mail), mail).toMatchObject({ licensed: true, reason: "ok" });
    }
    expect(check("an@abccorp.vn").keyPart).toHaveLength(32);
  });

  it("does not license another domain, a sub-domain, a look-alike or a bad profile", () => {
    expect(check("an@other.vn")).toEqual({ licensed: false, reason: "notListed", keyPart: null });
    expect(check("an@mail.abccorp.vn").reason).toBe("notListed");
    expect(check("an@abccorp.vn.evil.com").reason).toBe("notListed");
    expect(check("an@аbccorp.vn").reason).toBe("notListed"); // Cyrillic a
    for (const bad of ["", "no-at-sign", "a@b@c.vn", "@abccorp.vn", "an@"]) {
      expect(check(bad), bad).toEqual({ licensed: false, reason: "invalidProfile", keyPart: null });
    }
    expect(provider.check(undefined as never).reason).toBe("invalidProfile");
    expect(provider.check({ emailAddress: 7 as never }).reason).toBe("invalidProfile");
  });

  it("licenses nobody when the list is empty", () => {
    const empty = createBuildTimeDomainProvider({ salt: SALT, domainHashes: [] });
    expect(empty.check({ emailAddress: "an@abccorp.vn" })).toEqual({
      licensed: false,
      reason: "noList",
      keyPart: null,
    });
  });

  it("depends on the salt: a list built with another salt matches nothing", () => {
    const other = createBuildTimeDomainProvider({
      salt: "other-salt",
      domainHashes: [hashDomain(SALT, "abccorp.vn")],
    });
    expect(other.check({ emailAddress: "an@abccorp.vn" }).reason).toBe("notListed");
  });
});

describe("licensed key provider: the licence takes part in the key", () => {
  const licensed = check("an@abccorp.vn");
  const keys = createLicensedKeyProvider({ orgSecrets: [orgSecret(1)], license: licensed });

  it("yields a key for a licensed result and none for an unlicensed one", () => {
    expect(keys.current()?.secret).toHaveLength(32);
    expect(keys.current()?.keyId).toBe(keyIdOf(keys.current()?.secret ?? new Uint8Array(0)));
    const none = createLicensedKeyProvider({
      orgSecrets: [orgSecret(1)],
      license: check("an@other.vn"),
    });
    expect(none.current()).toBeNull();
    expect(none.byId(keys.current()?.keyId ?? "")).toBeNull();
    const forged = createLicensedKeyProvider({
      orgSecrets: [orgSecret(1)],
      license: { licensed: true, reason: "ok", keyPart: null },
    });
    expect(forged.current()).toBeNull();
  });

  it("derives different keys from different secrets, domains and rotations", () => {
    const other = createLicensedKeyProvider({ orgSecrets: [orgSecret(2)], license: licensed });
    const otherDomain = createLicensedKeyProvider({
      orgSecrets: [orgSecret(1)],
      license: check("x@auditfirm.vn"),
    });
    expect(other.current()?.keyId).not.toBe(keys.current()?.keyId);
    expect(otherDomain.current()?.keyId).not.toBe(keys.current()?.keyId);
    const rotated = createLicensedKeyProvider({
      orgSecrets: [orgSecret(2), orgSecret(1)],
      license: licensed,
    });
    expect(rotated.current()?.keyId).toBe(other.current()?.keyId);
    expect(rotated.byId(keys.current()?.keyId ?? "")).not.toBeNull();
    expect(rotated.byId("0000000000000000")).toBeNull();
  });

  it("makes the codec unusable for a build whose licence check was patched out", async () => {
    const real = createCodec({ keys, now: () => NOW });
    const code = await real.encodeRing(ring(), meta);
    expect(code.ok).toBe(true);
    // A build that forges "licensed" without a matching domain has the wrong key part.
    const forged = createLicensedKeyProvider({
      orgSecrets: [orgSecret(1)],
      license: { licensed: true, reason: "ok", keyPart: sha256(utf8("guess")) },
    });
    const patched = createCodec({ keys: forged, now: () => NOW });
    expect(await patched.decodeRing(code.ok ? code.value : "")).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
    expect((await real.decodeRing(code.ok ? code.value : "")).ok).toBe(true);
  });

  it("lets a colleague on the same domain read the code", async () => {
    const a = createCodec({ keys, now: () => NOW });
    const colleague = createLicensedKeyProvider({
      orgSecrets: [orgSecret(1)],
      license: check("other.person@abccorp.vn"),
    });
    const code = await a.encodeRing(ring(), meta);
    const read = await createCodec({ keys: colleague, now: () => NOW }).decodeRing(
      code.ok ? code.value : "",
    );
    expect(read.ok).toBe(true);
  });
});
