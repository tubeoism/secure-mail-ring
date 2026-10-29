import { describe, expect, it } from "vitest";
import type { GlobalSettings, Ring } from "@smr/core";
import type { StorageAdapter } from "../adapters";

export function runStorageAdapterContract(
  name: string,
  make: (budgetBytes: number) => StorageAdapter,
  ring: Ring,
  settings: GlobalSettings,
): void {
  describe(`StorageAdapter contract: ${name}`, () => {
    it("starts empty and round-trips rings and settings", async () => {
      const s = make(1_000_000);
      expect(await s.loadRings()).toEqual({ ok: true, value: [] });
      expect((await s.loadHistory()).ok).toBe(true);
      await s.saveRings([ring]);
      await s.saveSettings(settings);
      expect(await s.loadRings()).toEqual({ ok: true, value: [ring] });
      expect(await s.loadSettings()).toEqual({ ok: true, value: settings });
    });

    it("reports usage that grows with data and never exceeds the budget", async () => {
      const s = make(1_000_000);
      const empty = await s.usage();
      await s.saveRings([ring]);
      const used = await s.usage();
      if (!empty.ok || !used.ok) throw new Error("usage failed");
      expect(used.value.usedBytes).toBeGreaterThan(empty.value.usedBytes);
      expect(used.value.usedBytes).toBeLessThanOrEqual(used.value.budgetBytes);
    });

    it("rejects a write over quota and keeps the previous data", async () => {
      const s = make(200);
      const r = await s.saveRings([ring]);
      expect(r).toEqual({ ok: false, error: { code: "quota", messageKey: "error.storage.quota" } });
      expect(await s.loadRings()).toEqual({ ok: true, value: [] });
    });
  });
}
