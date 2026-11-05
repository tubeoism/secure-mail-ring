import fc from "fast-check";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import type { EvaluateInput } from "../src/api";
import { createEvaluate } from "../src/evaluate";
import { acknowledgementKey, computeFingerprint } from "../src/fingerprint";
import {
  EvaluationResultSchema,
  POLICY_KEYS,
  POLICY_MODES,
  VERDICTS,
  type Finding,
  type PolicyKey,
  type PolicyMode,
} from "../src/model";
import { sortRecipients } from "../src/order";
import { DEFAULT_POLICY, STRICT_POLICY, rankMode } from "../src/policy";
import { NOW, entry, file, knowing, mail, members, noHistory, ring, settings } from "./helpers";

const evaluate = createEvaluate(() => NOW);

const alpha = ring();
const beta = ring({
  id: "beta",
  name: "Beta",
  members: members("*.betacorp.vn"),
  attachments: { tokens: ["BETA"], mode: "any", ignoreInline: true, exemptExtensions: [] },
});

/** Every address mentioned below is known, so first-time findings only appear where a test wants. */
const KNOWN = [
  "a@abccorp.vn",
  "b@abccorp.vn",
  "cfo@abccorp.vn",
  "kt@partner.vn",
  "x@gmail.com",
  "colleague@tunt.pro",
  "p@auditfirm.vn",
  "b@deltaco.vn",
  "a@deltaco.vn",
];

const input = (over: Partial<EvaluateInput> = {}): EvaluateInput => ({
  ring: alpha,
  allRings: [alpha, beta],
  settings: settings(),
  snapshot: mail(),
  history: knowing(...KNOWN),
  acknowledged: [],
  ...over,
});

const kinds = (findings: readonly Finding[]) => findings.map((f) => f.kind);

describe("evaluate: plan examples (AC-2)", () => {
  it("F1 acceptance example: exactly one finding, x@gmail.com (BCC)", () => {
    const r = evaluate(
      input({
        snapshot: mail({
          to: [entry("a@abccorp.vn")],
          cc: [entry("kt@partner.vn")],
          bcc: [entry("x@gmail.com")],
          ringId: "r1",
        }),
      }),
    );
    expect(r.findings).toEqual([
      {
        kind: "outsider",
        mode: "warn",
        subject: "x@gmail.com",
        field: "bcc",
        messageKey: "finding.outsider",
        params: { address: "x@gmail.com", field: "BCC" },
      },
    ]);
    expect(r.verdict).toBe("warn");
  });

  it("a clean mail is allowed with no findings and no mutations", () => {
    const r = evaluate(
      input({
        snapshot: mail({ to: [entry("cfo@abccorp.vn")], attachments: [file("ALPHA_r.xlsx")] }),
      }),
    );
    expect(r.findings).toEqual([]);
    expect(r.mutations).toEqual([]);
    expect(r.verdict).toBe("allow");
  });

  it("an empty mail is allowed and still has a fingerprint", () => {
    const r = evaluate(input());
    expect(r.verdict).toBe("allow");
    expect(r.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("evaluate: findings (AC-3, D4)", () => {
  it("missing and foreign tokens carry the file and the foreign ring names", () => {
    const r = evaluate(
      input({
        snapshot: mail({
          to: [entry("cfo@abccorp.vn")],
          attachments: [file("report.xlsx"), file("BETA_draft.docx"), file("ALPHA_ok.xlsx")],
        }),
      }),
    );
    expect(r.findings).toEqual([
      {
        kind: "missingToken",
        mode: "warn",
        subject: "report.xlsx",
        messageKey: "finding.missingToken",
        params: { file: "report.xlsx" },
      },
      {
        kind: "foreignRingToken",
        mode: "warn",
        subject: "BETA_draft.docx",
        messageKey: "finding.foreignRingToken",
        params: { file: "BETA_draft.docx", ring: "Beta" },
      },
    ]);
  });

  it("look-alikes name the reference domain and the ring it comes from", () => {
    const r = evaluate(
      input({
        snapshot: mail({ to: [entry("cfo@abcc0rp.vn")], attachments: [file("ALPHA_x.xlsx")] }),
      }),
    );
    const lookalike = r.findings.find((f) => f.kind === "lookalike");
    expect(lookalike).toEqual({
      kind: "lookalike",
      mode: "warn",
      subject: "cfo@abcc0rp.vn",
      field: "to",
      messageKey: "finding.lookalike",
      params: { address: "cfo@abcc0rp.vn", similarTo: "abccorp.vn", ring: "Alpha" },
    });
  });

  it("a look-alike of the sender's own domain has an empty ring name", () => {
    const r = evaluate(
      input({
        ring: null,
        snapshot: mail({ to: [entry("a@tnut.pro")] }),
        history: knowing("a@tnut.pro"),
      }),
    );
    const lookalike = r.findings.find((f) => f.kind === "lookalike");
    expect(lookalike?.params).toEqual({ address: "a@tnut.pro", similarTo: "tunt.pro", ring: "" });
  });

  it("first-time recipients are reported by address", () => {
    const r = evaluate(
      input({
        history: noHistory(),
        snapshot: mail({ to: [entry("new@abccorp.vn")], attachments: [file("ALPHA_1.pdf")] }),
      }),
    );
    expect(r.findings).toEqual([
      {
        kind: "firstTime",
        mode: "warn",
        subject: "new@abccorp.vn",
        field: "to",
        messageKey: "finding.firstTime",
        params: { address: "new@abccorp.vn" },
      },
    ]);
  });

  it("an unresolved recipient is an outsider, named by display name", () => {
    const r = evaluate(
      input({
        snapshot: mail({
          to: [entry("", "Nguyễn Văn A", false)],
          attachments: [file("ALPHA_1.pdf")],
        }),
      }),
    );
    expect(r.findings).toEqual([
      {
        kind: "outsider",
        mode: "warn",
        subject: "Nguyễn Văn A",
        field: "to",
        messageKey: "finding.outsider",
        params: { address: "Nguyễn Văn A", field: "TO" },
      },
    ]);
    const bare = evaluate(input({ snapshot: mail({ to: [entry("???", "", false)] }) }));
    expect(bare.findings[0]?.subject).toBe("???");
  });

  describe("field rules", () => {
    const withRules = (rules: Parameters<typeof ring>[0] extends infer P ? P : never) =>
      ring(rules);
    const run = (
      fieldRules: ReturnType<typeof ring>["fieldRules"],
      snapshot: Parameters<typeof mail>[0],
    ) =>
      evaluate(
        input({
          ring: withRules({
            fieldRules,
            members: members("abccorp.vn", "deltaco.vn", "auditfirm.vn"),
          }),
          snapshot: mail({ attachments: [file("ALPHA_1.pdf")], ...snapshot }),
        }),
      ).findings;

    it("mustBeIn with nobody matching reports the pattern", () => {
      const f = run([{ pattern: "p@auditfirm.vn", type: "mustBeIn", field: "cc" }], {
        to: [entry("a@abccorp.vn")],
      });
      expect(f).toEqual([
        {
          kind: "fieldRule",
          mode: "warn",
          subject: "p@auditfirm.vn",
          field: "cc",
          messageKey: "finding.fieldRule.mustBeIn",
          params: { pattern: "p@auditfirm.vn", field: "CC" },
        },
      ]);
    });

    it("mustBeIn with the match in another field says where it is", () => {
      const f = run([{ pattern: "p@auditfirm.vn", type: "mustBeIn", field: "cc" }], {
        to: [entry("p@auditfirm.vn")],
      });
      expect(f[0]).toMatchObject({
        subject: "p@auditfirm.vn",
        field: "to",
        messageKey: "finding.fieldRule.mustBeIn",
        params: { address: "p@auditfirm.vn", field: "CC", foundIn: "TO" },
      });
    });

    it("mustNotBeIn names the recipient and the forbidden field", () => {
      const f = run([{ pattern: "deltaco.vn", type: "mustNotBeIn", field: "bcc" }], {
        to: [entry("a@deltaco.vn")],
        bcc: [entry("b@deltaco.vn")],
      });
      expect(f).toEqual([
        {
          kind: "fieldRule",
          mode: "warn",
          subject: "b@deltaco.vn",
          field: "bcc",
          messageKey: "finding.fieldRule.mustNotBeIn",
          params: { address: "b@deltaco.vn", field: "BCC" },
        },
      ]);
    });

    it("onlyIn reports each recipient outside the allowed field", () => {
      const f = run([{ pattern: "deltaco.vn", type: "onlyIn", field: "to" }], {
        to: [entry("a@deltaco.vn")],
        cc: [entry("b@deltaco.vn")],
      });
      expect(f).toEqual([
        {
          kind: "fieldRule",
          mode: "warn",
          subject: "b@deltaco.vn",
          field: "cc",
          messageKey: "finding.fieldRule.onlyIn",
          params: { address: "b@deltaco.vn", field: "TO", foundIn: "CC" },
        },
      ]);
    });
  });

  it("lists findings by kind, then field, then list order", () => {
    const strictFloor = Object.fromEntries(POLICY_KEYS.map((k) => [k, "warn"] as const));
    const r = evaluate(
      input({
        ring: ring({
          fieldRules: [{ pattern: "kt@partner.vn", type: "mustNotBeIn", field: "bcc" }],
        }),
        settings: settings({ policyFloor: strictFloor }),
        history: noHistory(),
        snapshot: mail({
          to: [entry("t2@abcc0rp.vn"), entry("t1@gmail.com")],
          cc: [entry("c1@gmail.com")],
          bcc: [entry("kt@partner.vn")],
          attachments: [file("zzz.pdf"), file("BETA_1.pdf"), file("yyy.pdf")],
        }),
      }),
    );
    expect(kinds(r.findings)).toEqual([
      "outsider",
      "outsider",
      "outsider",
      "missingToken",
      "missingToken",
      "foreignRingToken",
      "lookalike",
      "firstTime",
      "firstTime",
      "firstTime",
      "fieldRule",
    ]);
    expect(r.findings.filter((f) => f.kind === "outsider").map((f) => f.subject)).toEqual([
      "t2@abcc0rp.vn",
      "t1@gmail.com",
      "c1@gmail.com",
    ]);
    expect(r.findings.filter((f) => f.kind === "missingToken").map((f) => f.subject)).toEqual([
      "zzz.pdf",
      "yyy.pdf",
    ]);
  });

  it("returns the reordering of the ring and nothing else when the order is wrong", () => {
    const sorted = ring({ order: { to: ["b@abccorp.vn", "*"], cc: [], bcc: [] } });
    const snapshot = mail({ to: [entry("a@abccorp.vn"), entry("b@abccorp.vn")] });
    const r = evaluate(input({ ring: sorted, snapshot }));
    expect(r.mutations).toEqual(sortRecipients(sorted, snapshot));
    expect(r.mutations).toHaveLength(1);
  });
});

describe("evaluate: modes (AC-1, AC-2, D5)", () => {
  const messy = mail({
    to: [entry("cfo@abcc0rp.vn"), entry("x@gmail.com")],
    attachments: [file("BETA_1.pdf"), file("plain.pdf")],
  });

  it("applies the Strict preset of the plan", () => {
    const r = evaluate(input({ ring: ring({ policy: STRICT_POLICY }), snapshot: messy }));
    const modeOf = (k: PolicyKey) => r.findings.find((f) => f.kind === k)?.mode;
    expect(modeOf("outsider")).toBe("acknowledge");
    expect(modeOf("missingToken")).toBe("acknowledge");
    expect(modeOf("foreignRingToken")).toBe("block");
    expect(modeOf("lookalike")).toBe("block");
    expect(r.verdict).toBe("block");
  });

  it("raises a kind to the global floor and never lowers it", () => {
    const base = evaluate(input({ snapshot: messy }));
    expect(base.findings.every((f) => f.mode === "warn")).toBe(true);
    const floored = evaluate(
      input({
        snapshot: messy,
        settings: settings({ policyFloor: { foreignRingToken: "acknowledge" } }),
      }),
    );
    expect(floored.findings.find((f) => f.kind === "foreignRingToken")?.mode).toBe("acknowledge");
    expect(floored.findings.find((f) => f.kind === "outsider")?.mode).toBe("warn");
    const strictRing = evaluate(
      input({
        ring: ring({ policy: STRICT_POLICY }),
        snapshot: messy,
        settings: settings({ policyFloor: { lookalike: "warn" } }),
      }),
    );
    expect(strictRing.findings.find((f) => f.kind === "lookalike")?.mode).toBe("block");
  });

  it("treats a colleague as Warn under internalDomain warn, raised by the floor only (FR-1.7)", () => {
    const colleague = mail({
      to: [entry("colleague@tunt.pro")],
      attachments: [file("ALPHA_1.pdf")],
    });
    const r = evaluate(
      input({ ring: ring({ internalDomain: "warn", policy: STRICT_POLICY }), snapshot: colleague }),
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ kind: "outsider", mode: "warn" });
    const floored = evaluate(
      input({
        ring: ring({ internalDomain: "warn" }),
        snapshot: colleague,
        settings: settings({ policyFloor: { outsider: "acknowledge" } }),
      }),
    );
    expect(floored.findings[0]?.mode).toBe("acknowledge");
  });

  it("allows a colleague under internalDomain allow, and flags one under outsider with the ring mode", () => {
    const colleague = mail({
      to: [entry("colleague@tunt.pro")],
      attachments: [file("ALPHA_1.pdf")],
    });
    expect(evaluate(input({ snapshot: colleague })).findings).toEqual([]);
    const r = evaluate(
      input({
        ring: ring({ internalDomain: "outsider", policy: STRICT_POLICY }),
        snapshot: colleague,
      }),
    );
    expect(r.findings[0]).toMatchObject({ kind: "outsider", mode: "acknowledge" });
  });

  it("does not depend on the floor being applied to the stored ring (T-1)", () => {
    const r = ring();
    const before = structuredClone(r);
    evaluate(
      input({
        ring: r,
        snapshot: messy,
        settings: settings({ policyFloor: { outsider: "block" } }),
      }),
    );
    expect(r).toEqual(before);
  });
});

describe("evaluate: verdict and acknowledgement (AC-4, D6)", () => {
  const policy = { ...DEFAULT_POLICY, outsider: "acknowledge", lookalike: "block" } as const;
  const gated = ring({ policy });
  const snapshot = mail({
    to: [entry("cfo@abccorp.vn")],
    bcc: [entry("x@gmail.com")],
    attachments: [file("report.xlsx")],
  });
  const run = (acknowledged: string[], over: Partial<EvaluateInput> = {}) =>
    evaluate(input({ ring: gated, snapshot, acknowledged, ...over }));

  it("takes the strictest unsatisfied mode", () => {
    expect(run([]).verdict).toBe("acknowledge");
  });

  it("an acknowledged finding stops counting, a Warn finding remains", () => {
    const first = run([]);
    const outsider = first.findings.find((f) => f.kind === "outsider");
    if (outsider === undefined) throw new Error("expected an outsider finding");
    const key = acknowledgementKey(first.fingerprint, outsider);
    const second = run([key]);
    expect(second.verdict).toBe("warn");
    expect(second.findings).toEqual(first.findings);
    const cleared = run([key], {
      snapshot: mail({ ...snapshot, attachments: [file("ALPHA_1.xlsx")] }),
    });
    // the file changed, so the fingerprint changed and the old tick is void
    expect(cleared.verdict).toBe("acknowledge");
  });

  it("a key made for another fingerprint counts for nothing", () => {
    const outsider = run([]).findings.find((f) => f.kind === "outsider");
    if (outsider === undefined) throw new Error("expected an outsider finding");
    expect(run([acknowledgementKey("someone else's mail", outsider)]).verdict).toBe("acknowledge");
    expect(run(["garbage", ""]).verdict).toBe("acknowledge");
  });

  it("Warn can not be acknowledged away", () => {
    const warnOnly = evaluate(input({ snapshot: mail({ attachments: [file("report.xlsx")] }) }));
    const finding = warnOnly.findings[0];
    if (finding === undefined) throw new Error("expected a finding");
    const key = acknowledgementKey(warnOnly.fingerprint, finding);
    const again = evaluate(
      input({ snapshot: mail({ attachments: [file("report.xlsx")] }), acknowledged: [key] }),
    );
    expect(again.verdict).toBe("warn");
  });

  it("Block can not be acknowledged away", () => {
    const blocked = mail({ to: [entry("cfo@abcc0rp.vn")], attachments: [file("ALPHA_1.pdf")] });
    const first = evaluate(
      input({ ring: gated, snapshot: blocked, history: knowing("cfo@abcc0rp.vn") }),
    );
    const keys = first.findings.map((f) => acknowledgementKey(first.fingerprint, f));
    const again = evaluate(
      input({
        ring: gated,
        snapshot: blocked,
        history: knowing("cfo@abcc0rp.vn"),
        acknowledged: keys,
      }),
    );
    expect(first.verdict).toBe("block");
    expect(again.verdict).toBe("block");
  });

  it("keeps the verdict stable when the engine's own reordering is applied", () => {
    const reorder = ring({ policy, order: { to: ["x@gmail.com", "*"], cc: [], bcc: [] } });
    const m = mail({
      to: [entry("cfo@abccorp.vn"), entry("x@gmail.com")],
      attachments: [file("ALPHA_1.pdf")],
    });
    const first = evaluate(input({ ring: reorder, snapshot: m }));
    const mutated = { ...m };
    for (const mutation of first.mutations)
      Object.assign(mutated, { [mutation.field]: mutation.entries });
    const keys = first.findings.map((f) => acknowledgementKey(first.fingerprint, f));
    const second = evaluate(input({ ring: reorder, snapshot: mutated, acknowledged: keys }));
    expect(first.mutations.length).toBeGreaterThan(0);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.verdict).toBe("allow");
  });

  it("raising the floor never lowers the verdict (property)", () => {
    const mode = fc.constantFrom(...POLICY_MODES);
    const floor = fc.record(
      Object.fromEntries(POLICY_KEYS.map((k) => [k, mode])) as Record<PolicyKey, typeof mode>,
      { requiredKeys: [] },
    );
    const mixed = mail({
      to: [entry("cfo@abcc0rp.vn"), entry("x@gmail.com")],
      attachments: [file("BETA_1.pdf"), file("plain.pdf")],
    });
    fc.assert(
      fc.property(floor, floor, (f1, f2) => {
        const merged: Partial<Record<PolicyKey, PolicyMode>> = { ...f1 };
        for (const k of POLICY_KEYS) {
          const a = f1[k];
          const b = f2[k];
          if (b !== undefined && (a === undefined || rankMode(b) > rankMode(a))) merged[k] = b;
        }
        const low = evaluate(
          input({ snapshot: mixed, history: noHistory(), settings: settings({ policyFloor: f1 }) }),
        );
        const high = evaluate(
          input({
            snapshot: mixed,
            history: noHistory(),
            settings: settings({ policyFloor: merged }),
          }),
        );
        expect(VERDICTS.indexOf(high.verdict)).toBeGreaterThanOrEqual(
          VERDICTS.indexOf(low.verdict),
        );
      }),
    );
  });

  it("acknowledging every Acknowledge finding leaves exactly the Warn and Block level (property)", () => {
    const mode = fc.constantFrom(...POLICY_MODES);
    const policies = fc.record(
      Object.fromEntries(POLICY_KEYS.map((k) => [k, mode])) as Record<PolicyKey, typeof mode>,
    );
    const mixed = mail({
      to: [entry("cfo@abcc0rp.vn"), entry("x@gmail.com")],
      attachments: [file("BETA_1.pdf"), file("plain.pdf")],
    });
    fc.assert(
      fc.property(policies, (p) => {
        const r = ring({ policy: p });
        const first = evaluate(input({ ring: r, snapshot: mixed, history: noHistory() }));
        const keys = first.findings
          .filter((f) => f.mode === "acknowledge")
          .map((f) => acknowledgementKey(first.fingerprint, f));
        const second = evaluate(
          input({ ring: r, snapshot: mixed, history: noHistory(), acknowledged: keys }),
        );
        const rest = first.findings.filter((f) => f.mode !== "acknowledge");
        const top = rest.reduce((m, f) => Math.max(m, VERDICTS.indexOf(f.mode)), 0);
        expect(VERDICTS.indexOf(second.verdict)).toBe(top);
        expect(second.findings).toEqual(first.findings);
      }),
    );
  });
});

describe("evaluate: no ring and expired ring (AC-6, D8, D9)", () => {
  const snapshot = mail({
    to: [entry("a@abccorp.vn")],
    cc: [entry("colleague@tunt.pro")],
    bcc: [entry("x@gmail.com"), entry("", "Name", false)],
    attachments: [file("report.xlsx"), file("BETA_1.pdf")],
  });

  it("reports external recipients and nothing that needs a ring", () => {
    const r = evaluate(input({ ring: null, snapshot, history: noHistory() }));
    expect(r.findings.filter((f) => f.kind === "outsider").map((f) => f.subject)).toEqual([
      "a@abccorp.vn",
      "x@gmail.com",
      "Name",
    ]);
    expect(kinds(r.findings)).not.toContain("missingToken");
    expect(kinds(r.findings)).not.toContain("foreignRingToken");
    expect(kinds(r.findings)).not.toContain("fieldRule");
    expect(r.mutations).toEqual([]);
    expect(r.verdict).toBe("warn");
  });

  it("first-time warnings are limited to recipients outside the sender's domain", () => {
    const r = evaluate(input({ ring: null, snapshot, history: noHistory() }));
    expect(r.findings.filter((f) => f.kind === "firstTime").map((f) => f.subject)).toEqual([
      "a@abccorp.vn",
      "x@gmail.com",
    ]);
  });

  it("treats only the sender's exact domain as internal without a ring (I-1)", () => {
    const sub = mail({
      to: [entry("colleague@tunt.pro"), entry("a@sub.tunt.pro")],
    });
    const r = evaluate(input({ ring: null, snapshot: sub, history: noHistory() }));
    expect(r.findings.filter((f) => f.kind === "outsider").map((f) => f.subject)).toEqual([
      "a@sub.tunt.pro",
    ]);
  });

  it("takes modes from the default policy raised by the floor", () => {
    const r = evaluate(
      input({
        ring: null,
        snapshot,
        history: noHistory(),
        settings: settings({ policyFloor: { outsider: "block" } }),
      }),
    );
    expect(r.findings.find((f) => f.kind === "outsider")?.mode).toBe("block");
    expect(r.findings.find((f) => f.kind === "firstTime")?.mode).toBe("warn");
    expect(r.verdict).toBe("block");
  });

  it("an internal-only mail without a ring is allowed", () => {
    const internal = mail({ to: [entry("colleague@tunt.pro")] });
    expect(evaluate(input({ ring: null, snapshot: internal, history: noHistory() })).verdict).toBe(
      "allow",
    );
  });

  it("checks look-alikes without a ring (FR-6.5)", () => {
    const r = evaluate(
      input({
        ring: null,
        snapshot: mail({ to: [entry("a@abcc0rp.vn")] }),
        history: knowing("a@abcc0rp.vn"),
      }),
    );
    expect(r.findings.find((f) => f.kind === "lookalike")?.params.similarTo).toBe("abccorp.vn");
  });

  it("an expired bound ring behaves exactly like no ring", () => {
    const old = ring({ expiresAt: "2026-06-30T00:00:00Z" });
    const a = evaluate(input({ ring: old, allRings: [old, beta], snapshot, history: noHistory() }));
    const b = evaluate(
      input({ ring: null, allRings: [old, beta], snapshot, history: noHistory() }),
    );
    expect(a).toEqual(b);
  });

  it("a ring that expires later still works", () => {
    const fresh = ring({ expiresAt: "2026-12-31T00:00:00Z" });
    const r = evaluate(
      input({
        ring: fresh,
        snapshot: mail({ to: [entry("a@abccorp.vn")], attachments: [file("report.xlsx")] }),
      }),
    );
    expect(kinds(r.findings)).toEqual(["missingToken"]);
  });

  it("reads the clock it was given", () => {
    const old = ring({ expiresAt: "2026-06-30T00:00:00Z" });
    const early = createEvaluate(() => new Date("2026-01-01T00:00:00Z"));
    const m = mail({ to: [entry("a@abccorp.vn")], attachments: [file("report.xlsx")] });
    expect(kinds(early(input({ ring: old, snapshot: m })).findings)).toEqual(["missingToken"]);
  });
});

describe("evaluate: robustness (AC-11)", () => {
  it("does not change its input", () => {
    const i = input({
      snapshot: mail({ to: [entry("x@gmail.com")], attachments: [file("a.pdf")] }),
      acknowledged: ["k"],
    });
    const copy = structuredClone(i);
    evaluate(i);
    expect(i).toEqual(copy);
  });

  it("fingerprints the mail with the ring that was used", () => {
    const snapshot = mail({ to: [entry("x@gmail.com")] });
    expect(evaluate(input({ snapshot })).fingerprint).toBe(computeFingerprint(alpha, snapshot));
    expect(evaluate(input({ ring: null, snapshot })).fingerprint).toBe(
      computeFingerprint(null, snapshot),
    );
  });

  it("never throws and always returns a schema-valid result (property)", () => {
    const text = fc.string({ unit: "binary", maxLength: 30 });
    const address = fc.oneof(
      text,
      fc.constantFrom(
        "a@abccorp.vn",
        "x@gmail.com",
        "A@ABCCORP.VN",
        "a@abcc0rp.vn",
        "",
        "@",
        "a@@b",
      ),
    );
    const recipient = fc.record({ address, displayName: text, resolved: fc.boolean() });
    const attachment = fc.record({
      name: text,
      isInline: fc.boolean(),
      kind: fc.constantFrom("file", "item", "cloud"),
    });
    fc.assert(
      fc.property(
        fc.array(recipient, { maxLength: 4 }),
        fc.array(recipient, { maxLength: 4 }),
        fc.array(recipient, { maxLength: 4 }),
        fc.array(attachment, { maxLength: 4 }),
        fc.boolean(),
        text,
        (to, cc, bcc, attachments, withRing, from) => {
          const r = evaluate(
            input({
              ring: withRing ? ring({ policy: STRICT_POLICY }) : null,
              snapshot: mail({ from, to, cc, bcc, attachments }),
              history: noHistory(),
            }),
          );
          expect(v.safeParse(EvaluationResultSchema, r).success).toBe(true);
        },
      ),
    );
  });
});
