// The send-time decision (plan section 5.2): every detector of CL-03 and CL-04 feeds one list of
// findings, each with its effective mode, plus the reordering to apply, one verdict and the
// fingerprint that acknowledgements bind to. Findings carry i18n keys and parameters, never text.
import type { EvaluateInput } from "./api";
import { checkAttachments } from "./attachments";
import { isRingExpired } from "./expiry";
import { acknowledgementKey, computeFingerprint } from "./fingerprint";
import { evaluateFieldRules, type FieldRuleViolation } from "./fieldRules";
import { findFirstTimeRecipients } from "./history";
import { findLookalikes } from "./lookalike";
import { findOutsiders } from "./match";
import {
  VERDICTS,
  type FieldName,
  type Finding,
  type EvaluationResult,
  type PolicyKey,
  type RecipientEntry,
  type Ring,
  type Verdict,
} from "./model";
import { splitAddress } from "./normalize";
import { sortRecipients } from "./order";
import { DEFAULT_POLICY, applyFloor, mergePolicy, stricter } from "./policy";

const label = (field: FieldName): string => field.toUpperCase();

type Draft = Omit<Finding, "mode">;

const draft = (
  kind: PolicyKey,
  subject: string,
  messageKey: string,
  params: Record<string, string>,
  field?: FieldName,
): Draft => ({ kind, subject, messageKey, params, ...(field === undefined ? {} : { field }) });

/** A recipient outside the sender's domain; an address that does not parse counts as outside. */
const isExternal = (entry: RecipientEntry, senderDomain: string | null): boolean => {
  const parsed = splitAddress(entry.address);
  return !parsed.ok || senderDomain === null || parsed.value.domain !== senderDomain;
};

function fieldRuleDraft(v: FieldRuleViolation): Draft {
  const key = `finding.fieldRule.${v.rule.type}`;
  const field = label(v.rule.field);
  if (v.entry === undefined) {
    return draft(
      "fieldRule",
      v.rule.pattern,
      key,
      { pattern: v.rule.pattern, field },
      v.rule.field,
    );
  }
  const params: Record<string, string> = { address: v.entry.address, field };
  if (v.kind === "misplaced" && v.foundIn !== undefined) params.foundIn = label(v.foundIn);
  return draft("fieldRule", v.entry.address, key, params, v.foundIn ?? v.rule.field);
}

const ringName = (rings: readonly Ring[], id: string | null): string =>
  rings.find((r) => r.id === id)?.name ?? "";

/** Drafts of every finding, grouped by kind in `POLICY_KEYS` order, each in field and list order. */
function collect(input: EvaluateInput, ring: Ring | null, now: Date) {
  const { snapshot, settings } = input;
  const sender = splitAddress(snapshot.from);
  const senderDomain = sender.ok ? sender.value.domain : null;
  const outsider: { draft: Draft; internal: boolean }[] = findOutsiders(
    ring ?? { members: [], internalDomain: "allow" },
    snapshot,
  ).map((o) => {
    const who =
      o.reason === "unresolved" ? o.entry.displayName || o.entry.address : o.entry.address;
    return {
      draft: draft(
        "outsider",
        who,
        "finding.outsider",
        { address: who, field: label(o.field) },
        o.field,
      ),
      internal: o.reason === "internal",
    };
  });

  const checks =
    ring === null ? [] : checkAttachments(ring, input.allRings, snapshot.attachments, now);
  const fileDrafts = (status: string): Draft[] =>
    checks
      .filter((c) => c.status === status)
      .map((c) => {
        const file = c.attachment.name;
        return status === "missingToken"
          ? draft("missingToken", file, "finding.missingToken", { file })
          : draft("foreignRingToken", file, "finding.foreignRingToken", {
              file,
              ring: c.foreignRingIds.map((id) => ringName(input.allRings, id)).join(", "),
            });
      });

  const lookalike = findLookalikes({
    ring,
    rings: input.allRings,
    snapshot,
    exceptions: settings.lookalikeExceptions,
    now,
  }).map((m) =>
    draft(
      "lookalike",
      m.entry.address,
      "finding.lookalike",
      {
        address: m.entry.address,
        similarTo: m.reference.domain,
        ring: ringName(input.allRings, m.reference.ringId),
      },
      m.field,
    ),
  );

  const firstTime = findFirstTimeRecipients({
    ring,
    snapshot,
    history: input.history,
    settings,
    now,
  })
    // Without a ring only outsiders count, so that everyday internal mail stays quiet (D-05).
    .filter((f) => ring !== null || isExternal(f.entry, senderDomain))
    .map((f) =>
      draft(
        "firstTime",
        f.entry.address,
        "finding.firstTime",
        { address: f.entry.address },
        f.field,
      ),
    );

  const fieldRule =
    ring === null ? [] : evaluateFieldRules(ring.fieldRules, snapshot).map(fieldRuleDraft);

  return {
    outsider,
    missingToken: fileDrafts("missingToken"),
    foreignRingToken: fileDrafts("foreignRingToken"),
    lookalike,
    firstTime,
    fieldRule,
  };
}

export function createEvaluate(now: () => Date) {
  return function evaluate(input: EvaluateInput): EvaluationResult {
    const at = now();
    // An archived ring (E-8) is treated as no ring: its members left the engagement.
    const ring = input.ring !== null && !isRingExpired(input.ring, at) ? input.ring : null;
    const { policyFloor } = input.settings;
    const policy =
      ring === null ? applyFloor(DEFAULT_POLICY, policyFloor) : mergePolicy(ring, input.settings);
    const found = collect(input, ring, at);

    const findings: Finding[] = [
      // A colleague outside the ring under `internalDomain: "warn"` is Warn, raised by the floor only.
      ...found.outsider.map(({ draft: d, internal }) => ({
        ...d,
        mode: internal ? stricter("warn", policyFloor.outsider ?? "warn") : policy.outsider,
      })),
      ...found.missingToken.map((d) => ({ ...d, mode: policy.missingToken })),
      ...found.foreignRingToken.map((d) => ({ ...d, mode: policy.foreignRingToken })),
      ...found.lookalike.map((d) => ({ ...d, mode: policy.lookalike })),
      ...found.firstTime.map((d) => ({ ...d, mode: policy.firstTime })),
      ...found.fieldRule.map((d) => ({ ...d, mode: policy.fieldRule })),
    ];

    const fingerprint = computeFingerprint(ring, input.snapshot);
    const acknowledged = new Set(input.acknowledged);
    let verdict: Verdict = "allow";
    for (const finding of findings) {
      const satisfied =
        finding.mode === "acknowledge" &&
        acknowledged.has(acknowledgementKey(fingerprint, finding));
      if (!satisfied && VERDICTS.indexOf(finding.mode) > VERDICTS.indexOf(verdict)) {
        verdict = finding.mode;
      }
    }
    const mutations = ring === null ? [] : sortRecipients(ring, input.snapshot);
    return { findings, mutations: [...mutations], verdict, fingerprint };
  };
}
