// Reusable contract suite: the mock passes it now, the real adapter (CL-06) must pass it
// against a live item or an Office.js test double. Import only from test files.
import { describe, expect, it } from "vitest";
import type { ComposeSnapshot } from "@smr/core";
import type { OfficeAdapter } from "../adapters";

export function runOfficeAdapterContract(
  name: string,
  make: (snapshot: ComposeSnapshot) => OfficeAdapter,
  snapshot: ComposeSnapshot,
): void {
  describe(`OfficeAdapter contract: ${name}`, () => {
    it("returns a snapshot equal to the item it was seeded from", async () => {
      const r = await make(snapshot).getSnapshot();
      expect(r).toEqual({ ok: true, value: snapshot });
    });

    it("reads each recipient field and the subject", async () => {
      const a = make(snapshot);
      for (const field of ["to", "cc", "bcc"] as const) {
        const r = await a.getRecipients(field);
        expect(r.ok && r.value).toEqual(snapshot[field]);
      }
      const subject = await a.getSubject();
      expect(subject.ok && subject.value).toBe(snapshot.subject);
    });

    it("preserves the exact recipient multiset when order is rewritten (FR-3.6)", async () => {
      const a = make(snapshot);
      const before = await a.getRecipients("to");
      if (!before.ok) throw new Error("getRecipients failed");
      const reversed = [...before.value].reverse();
      const set = await a.setRecipients("to", reversed);
      expect(set.ok).toBe(true);
      const after = await a.getRecipients("to");
      expect(after.ok && [...after.value].map((e) => e.address).sort()).toEqual(
        before.value.map((e) => e.address).sort(),
      );
    });

    it("reads attachment names only and exposes no content accessor", async () => {
      const a = make(snapshot);
      const r = await a.getAttachments();
      expect(r.ok && r.value.map((x) => x.name)).toEqual(snapshot.attachments.map((x) => x.name));
      expect(
        Object.keys(a).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(a))),
      ).not.toContain("getAttachmentContent");
    });

    it("round-trips session data and custom properties, null when absent", async () => {
      const a = make(snapshot);
      expect(await a.getSessionData("k")).toEqual({ ok: true, value: null });
      await a.setSessionData("k", "v");
      expect(await a.getSessionData("k")).toEqual({ ok: true, value: "v" });
      expect(await a.getCustomProperty("p")).toEqual({ ok: true, value: null });
      await a.setCustomProperty("p", "w");
      expect(await a.getCustomProperty("p")).toEqual({ ok: true, value: "w" });
    });

    it("never rejects: results are values", async () => {
      const a = make(snapshot);
      await expect(
        a.displayNewMessage({ to: [], subject: "s", body: "b" }),
      ).resolves.toHaveProperty("ok");
      await expect(a.getReadBody()).resolves.toHaveProperty("ok");
      await expect(a.getInternetHeaders()).resolves.toHaveProperty("ok");
      await expect(a.showNotification("app.loading")).resolves.toHaveProperty("ok");
    });
  });
}
