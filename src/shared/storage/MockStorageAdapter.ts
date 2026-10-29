// In-memory StorageAdapter. Mirrors roamingSettings semantics closely enough for the UI:
// values are serialised, usage is measured in UTF-8 bytes, and a write that would exceed
// the quota fails with `quota` and leaves the stored data unchanged.
import {
  err,
  ok,
  parseHistory,
  parseRing,
  parseSettings,
  type GlobalSettings,
  type HistoryState,
  type Ring,
} from "@smr/core";
import type { StorageAdapter, StorageResult, StorageUsage } from "../contracts/adapters";

export const DEFAULT_BUDGET_BYTES = 32 * 1024;

const EMPTY_SETTINGS: GlobalSettings = {
  schema: "smr/1",
  policyFloor: {},
  lookalikeExceptions: [],
  learning: { enabled: true, until: null },
  language: "vi",
};

const byteLength = (s: string) => new TextEncoder().encode(s).length;

export class MockStorageAdapter implements StorageAdapter {
  private readonly data = new Map<string, string>();

  constructor(private readonly budgetBytes: number = DEFAULT_BUDGET_BYTES) {}

  private used(): number {
    let total = 0;
    for (const [k, v] of this.data) total += byteLength(k) + byteLength(v);
    return total;
  }

  private write(key: string, value: unknown): StorageResult<void> {
    const json = JSON.stringify(value);
    const others = this.used() - byteLength(key) - byteLength(this.data.get(key) ?? "");
    if (others + byteLength(key) + byteLength(json) > this.budgetBytes) {
      return Promise.resolve(err({ code: "quota", messageKey: "error.storage.quota" }));
    }
    this.data.set(key, json);
    return Promise.resolve(ok(undefined));
  }

  private read(key: string): unknown {
    const raw = this.data.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as unknown);
  }

  loadRings(): StorageResult<readonly Ring[]> {
    const raw = this.read("rings");
    if (raw === undefined) return Promise.resolve(ok([]));
    if (!Array.isArray(raw))
      return Promise.resolve(err({ code: "corrupt", messageKey: "error.storage.failed" }));
    const rings: Ring[] = [];
    for (const item of raw as unknown[]) {
      const r = parseRing(item);
      if (!r.ok)
        return Promise.resolve(err({ code: "corrupt", messageKey: "error.storage.failed" }));
      rings.push(r.value);
    }
    return Promise.resolve(ok(rings));
  }
  saveRings(rings: readonly Ring[]) {
    return this.write("rings", rings);
  }
  loadSettings(): StorageResult<GlobalSettings> {
    const raw = this.read("settings");
    if (raw === undefined) return Promise.resolve(ok(EMPTY_SETTINGS));
    const r = parseSettings(raw);
    return Promise.resolve(
      r.ok ? ok(r.value) : err({ code: "corrupt", messageKey: "error.storage.failed" }),
    );
  }
  saveSettings(settings: GlobalSettings) {
    return this.write("settings", settings);
  }
  loadHistory(): StorageResult<HistoryState | null> {
    const raw = this.read("history");
    if (raw === undefined) return Promise.resolve(ok(null));
    const r = parseHistory(raw);
    return Promise.resolve(
      r.ok ? ok(r.value) : err({ code: "corrupt", messageKey: "error.storage.failed" }),
    );
  }
  saveHistory(history: HistoryState) {
    return this.write("history", history);
  }
  usage(): StorageResult<StorageUsage> {
    const usage: StorageUsage = { usedBytes: this.used(), budgetBytes: this.budgetBytes };
    return Promise.resolve(ok(usage));
  }
}
