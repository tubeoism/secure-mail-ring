import { describe, expect, it } from "vitest";
import {
  I18N_KEYS,
  MockOfficeAdapter,
  MockStorageAdapter,
  POLICY_MODES,
  POLICY_KEYS,
  createTranslator,
  fixtures,
  stubCore,
} from "./index";
import { runOfficeAdapterContract } from "./testing/officeAdapterContract";
import { runStorageAdapterContract } from "./testing/storageAdapterContract";

const first = fixtures.compose[0];
const ring = fixtures.rings[0];
if (!first || !ring) throw new Error("fixtures missing");

runOfficeAdapterContract("MockOfficeAdapter", (s) => new MockOfficeAdapter(s), first.snapshot);
runStorageAdapterContract(
  "MockStorageAdapter",
  (b) => new MockStorageAdapter(b),
  ring,
  fixtures.settings,
);

describe("MockOfficeAdapter", () => {
  it("records writes and can be told to fail", async () => {
    const a = new MockOfficeAdapter(first.snapshot, { failing: ["setSubject"] });
    expect(await a.setSubject("x")).toEqual({
      ok: false,
      error: { code: "failed", messageKey: "error.adapter.failed" },
    });
    expect(a.calls.map((c) => c.method)).toEqual(["setSubject"]);
  });

  it("collects drafts and serves read-mode data", async () => {
    const a = new MockOfficeAdapter(first.snapshot, {
      readBody: "hi",
      internetHeaders: "h: v",
      userAddress: "u@x.vn",
    });
    await a.displayNewMessage({ to: ["a@x.vn"], subject: "s", body: "b" });
    expect(a.drafts).toHaveLength(1);
    expect(await a.getReadBody()).toEqual({ ok: true, value: "hi" });
    expect(await a.getInternetHeaders()).toEqual({ ok: true, value: "h: v" });
    expect(await a.getUserAddress()).toEqual({ ok: true, value: "u@x.vn" });
    expect(await new MockOfficeAdapter(first.snapshot).getFromAddress()).toEqual({
      ok: true,
      value: first.snapshot.from,
    });
  });
});

describe("MockStorageAdapter", () => {
  it("handles history, default settings and corrupt data", async () => {
    const s = new MockStorageAdapter();
    expect(await s.loadSettings()).toMatchObject({
      ok: true,
      value: { schema: "smr/1", language: "vi" },
    });
    expect(
      await s.saveHistory({
        schema: "smr/1",
        salt: "s",
        current: "AAAA",
        previous: null,
        count: 1,
      }),
    ).toEqual({ ok: true, value: undefined });
    expect(await s.loadHistory()).toMatchObject({ ok: true, value: { count: 1 } });
    // @ts-expect-error reach into the private map to simulate a corrupt roamingSettings blob
    s.data.set("rings", JSON.stringify([{ nope: true }]));
    expect(await s.loadRings()).toMatchObject({ ok: false, error: { code: "corrupt" } });
    // @ts-expect-error private map reached to seed corrupt data
    s.data.set("rings", JSON.stringify({ not: "an array" }));
    expect(await s.loadRings()).toMatchObject({ ok: false, error: { code: "corrupt" } });
    // @ts-expect-error private map reached to seed corrupt data
    s.data.set("settings", "{}");
    expect(await s.loadSettings()).toMatchObject({ ok: false });
    // @ts-expect-error private map reached to seed corrupt data
    s.data.set("history", "{}");
    expect(await s.loadHistory()).toMatchObject({ ok: false });
  });

  it("the maximal fixture ring fits the default budget but trips the 80% storage-meter warning", async () => {
    const big = fixtures.rings.find((r) => r.members.length >= 500);
    if (!big) throw new Error("fixture");
    const s = new MockStorageAdapter();
    expect(await s.saveRings([big])).toEqual({ ok: true, value: undefined });
    const usage = await s.usage();
    if (!usage.ok) throw new Error("usage");
    expect(usage.value.usedBytes / usage.value.budgetBytes).toBeGreaterThan(0.8);
    expect(usage.value.usedBytes).toBeLessThan(usage.value.budgetBytes);
  });
});

describe("fixtures", () => {
  it("cover at least four rings including a Strict, an expired and a field-rule ring", () => {
    expect(fixtures.rings.length).toBeGreaterThanOrEqual(4);
    expect(fixtures.rings.some((r) => r.policy.foreignRingToken === "block")).toBe(true);
    expect(fixtures.rings.some((r) => r.expiresAt !== null)).toBe(true);
    expect(fixtures.rings.some((r) => r.fieldRules.length > 0)).toBe(true);
    expect(fixtures.rings.some((r) => r.members.length >= 500)).toBe(true);
  });

  it("have every finding kind in every policy mode", () => {
    for (const kind of POLICY_KEYS) {
      for (const mode of POLICY_MODES) {
        expect(fixtures.findings.some((f) => f.kind === kind && f.mode === mode)).toBe(true);
      }
    }
  });

  it("only use fictional domains and keep Vietnamese and Cyrillic cases", () => {
    const text = JSON.stringify([fixtures.compose, fixtures.rings]);
    const domains = new Set([...text.matchAll(/@([a-z0-9-]+\.[a-z.]+)/g)].map((m) => m[1]));
    const allowed = [
      "abccorp.vn",
      "partner.vn",
      "gmail.com",
      "auditfirm.vn",
      "betacorp.vn",
      "deltaco.vn",
      "bigco.vn",
      "abcc0rp.vn",
    ];
    for (const d of domains) expect(allowed).toContain(d);
    expect(text).toMatch(/[Ѐ-ӿ]/);
    expect(text).toMatch(/[ểọ]/);
  });

  it("reference only existing compose fixtures from evaluations", () => {
    for (const e of fixtures.evaluations)
      expect(fixtures.compose.some((c) => c.name === e.compose)).toBe(true);
  });

  it("use only i18n keys that exist in the contract list", () => {
    for (const f of fixtures.findings) expect(I18N_KEYS).toContain(f.messageKey);
    for (const e of fixtures.evaluations)
      for (const f of e.result.findings) expect(I18N_KEYS).toContain(f.messageKey);
  });
});

describe("stubCore (fixture-backed)", () => {
  it("returns canned evaluations by snapshot and allows unknown ones", () => {
    const named = fixtures.compose.find((c) => c.name === "outsider-bcc");
    if (!named) throw new Error("fixture");
    const input = {
      ring,
      allRings: fixtures.rings,
      settings: fixtures.settings,
      history: { schema: "smr/1" as const, salt: "s", current: "", previous: null, count: 0 },
      acknowledged: [],
    };
    expect(stubCore.evaluate({ ...input, snapshot: named.snapshot }).findings[0]?.kind).toBe(
      "outsider",
    );
    expect(
      stubCore.evaluate({ ...input, snapshot: { ...named.snapshot, subject: "unseen" } }).verdict,
    ).toBe("allow");
  });

  it("covers every finding kind and every verdict through canned evaluations", () => {
    const kinds = new Set(
      fixtures.evaluations.flatMap((e) => e.result.findings.map((f) => f.kind)),
    );
    expect([...kinds].sort()).toEqual([...POLICY_KEYS].sort());
    const verdicts = new Set(fixtures.evaluations.map((e) => e.result.verdict));
    expect([...verdicts].sort()).toEqual(["acknowledge", "allow", "block", "warn"]);
  });
});

describe("i18n", () => {
  it("interpolates params, falls back to the key, and honours the language", () => {
    const t = createTranslator("vi", {
      vi: { "common.save": "Lưu {n}" },
      en: { "common.save": "Save" },
    });
    expect(t("common.save", { n: 2 })).toBe("Lưu 2");
    expect(t("common.save")).toBe("Lưu {n}");
    expect(t("common.cancel")).toBe("common.cancel");
    expect(createTranslator("en", { en: { "common.save": "Save" } })("common.save")).toBe("Save");
    expect(createTranslator("en", {})("common.save")).toBe("common.save");
  });

  it("rejects unknown keys at compile time", () => {
    const t = createTranslator("en", {});
    // @ts-expect-error not a contract key
    t("not.a.key");
    expect(I18N_KEYS.length).toBeGreaterThan(100);
    expect(new Set(I18N_KEYS).size).toBe(I18N_KEYS.length);
  });
});
