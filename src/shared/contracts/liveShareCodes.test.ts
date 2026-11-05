import { describe, expect, it } from "vitest";
import {
  LIVE_SHARE_CODE_ERRORS,
  buildLiveShareCodes,
  core,
  devKeys,
  foreignDevKeys,
  type LiveShareCodes,
} from "./index";

// The fixtures of contract-v2: real codes made with the public development keys.
describe("live share-code fixtures", () => {
  let codes: LiveShareCodes;
  const decode = (code: string) => core.decodeRing(code);

  it("builds, and the valid code decodes to the fixture ring with its issuer", async () => {
    codes = await buildLiveShareCodes();
    const d = await decode(codes.valid);
    expect(d.ok && d.value.ring).toEqual(codes.ring);
    expect(d.ok && d.value.issuer).toBe(codes.issuer);
    expect(codes.valid.startsWith("-----BEGIN MAILRING-----\n")).toBe(true);
  });

  it("decodes the spaced and the quoted copies to the same ring", async () => {
    for (const text of [codes.spaced, codes.quoted]) {
      expect(text).not.toBe(codes.valid);
      const d = await decode(text);
      expect(d.ok && d.value.ring).toEqual(codes.ring);
    }
  });

  it("gives the documented error for each broken code", async () => {
    for (const name of ["tampered", "expired", "oversize", "foreignKey"] as const) {
      const d = await decode(codes[name]);
      expect(d.ok ? "ok" : d.error.code, name).toBe(LIVE_SHARE_CODE_ERRORS[name]);
    }
  });

  it("builds a different valid code each time (fresh IV) that still decodes", async () => {
    const again = await buildLiveShareCodes();
    expect(again.valid).not.toBe(codes.valid);
    expect((await decode(again.valid)).ok).toBe(true);
  });

  it("round-trips a fixture ring through encode and decode, as the export screen will", async () => {
    const meta = { issuer: "me@abccorp.vn", issuedAt: "2026-11-05T09:00:00Z" };
    const e = await core.encodeRing(codes.ring, meta);
    const d = await core.decodeRing(e.ok ? e.value : "");
    expect(d.ok && d.value.ring).toEqual(codes.ring);
  });

  it("uses public dev keys that the production wiring never reads", () => {
    expect(devKeys.current()?.keyId).not.toBe(foreignDevKeys.current()?.keyId);
    expect(devKeys.byId(foreignDevKeys.current()?.keyId ?? "")).toBeNull();
    expect(foreignDevKeys.byId(devKeys.current()?.keyId ?? "")).toBeNull();
    expect(devKeys.byId("0000000000000000")).toBeNull();
  });
});
