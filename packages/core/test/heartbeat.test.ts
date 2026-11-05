import fc from "fast-check";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { sha256, utf8 } from "../src/hash";
import {
  HeartbeatPayloadSchema,
  buildHeartbeat,
  hashMailbox,
  shouldSendHeartbeat,
} from "../src/heartbeat";

const input = {
  mailbox: "an.nguyen@abccorp.vn",
  salt: "heartbeat-salt",
  bundleVersion: "1.0.0",
  manifestVersion: "1",
};

describe("buildHeartbeat (D-17, NFR-3)", () => {
  it("has exactly three fields: the salted mailbox hash and two versions", () => {
    const r = buildHeartbeat(input);
    expect(r.ok).toBe(true);
    const payload = r.ok ? r.value : null;
    expect(Object.keys(payload ?? {}).sort()).toEqual(["bundle", "h", "manifest"]);
    expect(payload).toEqual({
      h: Buffer.from(sha256(utf8("heartbeat-salt\u0000an.nguyen@abccorp.vn"))).toString("hex"),
      bundle: "1.0.0",
      manifest: "1",
    });
    expect(v.safeParse(HeartbeatPayloadSchema, payload).success).toBe(true);
  });

  it("carries nothing the caller put in apart from the hash and the versions (property)", () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 30 }),
        (mailbox, salt) => {
          const r = buildHeartbeat({ ...input, mailbox, salt });
          if (!r.ok) return;
          const text = JSON.stringify(r.value);
          expect(text.includes(mailbox)).toBe(false);
          // A short local part such as "a" or "1" is of course found in a hex digest by chance.
          const local = mailbox.split("@")[0] ?? "";
          expect(local.length >= 8 && text.includes(local)).toBe(false);
          expect(text.includes(salt) && salt.length > 6).toBe(false);
          expect(v.safeParse(HeartbeatPayloadSchema, r.value).success).toBe(true);
        },
      ),
    );
  });

  it("does not depend on the case or notation of the mailbox, but on the salt and the mailbox", () => {
    const h = (over: object) => {
      const r = buildHeartbeat({ ...input, ...over });
      return r.ok ? r.value.h : r.error.code;
    };
    expect(h({ mailbox: "AN.Nguyen@ABCCorp.VN" })).toBe(h({}));
    expect(h({ mailbox: "  an.nguyen@abccorp.vn. " })).toBe(h({}));
    expect(h({ salt: "other" })).not.toBe(h({}));
    expect(h({ mailbox: "someone@abccorp.vn" })).not.toBe(h({}));
  });

  it("refuses a bad mailbox, an empty salt and versions that could carry free text", () => {
    expect(buildHeartbeat({ ...input, mailbox: "nope" })).toEqual({
      ok: false,
      error: { code: "badMailbox" },
    });
    expect(buildHeartbeat({ ...input, salt: "" })).toEqual({
      ok: false,
      error: { code: "noSalt" },
    });
    for (const bad of ["", " 1.0", "1.0 beta", "x".repeat(33), "a@b.vn", "-1", "1/2", "v1\n"]) {
      expect(buildHeartbeat({ ...input, bundleVersion: bad }), bad).toEqual({
        ok: false,
        error: { code: "badVersion" },
      });
      expect(buildHeartbeat({ ...input, manifestVersion: bad }), bad).toEqual({
        ok: false,
        error: { code: "badVersion" },
      });
    }
    for (const good of ["1", "1.0.0", "2026.11.05+build.7", "v1_rc-2"]) {
      expect(buildHeartbeat({ ...input, bundleVersion: good }).ok, good).toBe(true);
    }
  });

  it("the schema rejects extra fields and a malformed hash", () => {
    const ok = { h: "a".repeat(64), bundle: "1", manifest: "1" };
    expect(v.safeParse(HeartbeatPayloadSchema, ok).success).toBe(true);
    expect(v.safeParse(HeartbeatPayloadSchema, { ...ok, to: "x@y.vn" }).success).toBe(false);
    expect(v.safeParse(HeartbeatPayloadSchema, { ...ok, h: "A".repeat(64) }).success).toBe(false);
    expect(v.safeParse(HeartbeatPayloadSchema, { ...ok, h: "a".repeat(63) }).success).toBe(false);
    expect(v.safeParse(HeartbeatPayloadSchema, { bundle: "1", manifest: "1" }).success).toBe(false);
  });

  it("hashMailbox is what the coverage report computes for a user list", () => {
    const r = hashMailbox("s", "A@B.vn");
    expect(r).toEqual(hashMailbox("s", "a@b.vn"));
    expect(hashMailbox("s", "x")).toEqual({ ok: false, error: { code: "badMailbox" } });
  });
});

describe("shouldSendHeartbeat", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const HOUR = 3_600_000;

  it("sends when nothing was sent, or the record is unreadable", () => {
    expect(shouldSendHeartbeat(null, now)).toBe(true);
    expect(shouldSendHeartbeat("", now)).toBe(true);
    expect(shouldSendHeartbeat("yesterday", now)).toBe(true);
  });

  it("sends once a day: not at 23 h 59 min, yes at 24 h", () => {
    expect(shouldSendHeartbeat(ago(24 * HOUR - 60_000), now)).toBe(false);
    expect(shouldSendHeartbeat(ago(24 * HOUR), now)).toBe(true);
    expect(shouldSendHeartbeat(ago(48 * HOUR), now)).toBe(true);
    expect(shouldSendHeartbeat(ago(0), now)).toBe(false);
  });

  it("copes with a clock that moved back: a time slightly ahead waits, far ahead sends", () => {
    expect(shouldSendHeartbeat(ago(-HOUR), now)).toBe(false);
    expect(shouldSendHeartbeat(ago(-24 * HOUR), now)).toBe(false);
    expect(shouldSendHeartbeat(ago(-24 * HOUR - 1000), now)).toBe(true);
  });
});
