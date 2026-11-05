// Difference between the ring on the device and an incoming one (FR-2.6, FR-2.7), for the import
// preview. Members are compared in normal form so a change of case or notation is not shown as a
// removal plus an addition. Besides members and modes the diff reports the settings that could be
// weakened unseen (contract-v2, gap G-1, threat T-1): the treatment of the sender's own domain, the
// first-time check, field rules, attachment tokens and exemptions.
import type { PolicyChange, RevRelation, RingDiff, SettingChange } from "./api";
import { canonicalText } from "./normalize";
import { compileMember } from "./match";
import { POLICY_KEYS, type FieldRule, type Member, type Ring } from "./model";
import { rankMode } from "./policy";

function memberKey(member: Member): string {
  const compiled = compileMember(member);
  return compiled === null
    ? `?${member.kind}:${member.value}`
    : `${compiled.kind}:${compiled.value}`;
}

const ruleKey = (r: FieldRule) =>
  JSON.stringify([canonicalText(r.pattern.trim()), r.type, r.field, r.when ?? null]);

/** Strictness of the treatment of the sender's own domain: a higher rank checks more. */
const INTERNAL_RANK: Record<Ring["internalDomain"], number> = { allow: 0, warn: 1, outsider: 2 };

function relation(before: Ring | null, after: Ring): RevRelation {
  if (before === null) return "new";
  if (after.rev > before.rev) return "newer";
  return after.rev === before.rev ? "same" : "older";
}

/** Items of `next` that are not in `previous`, compared by `key`, in `next` order. */
function added<T>(previous: readonly T[], next: readonly T[], key: (x: T) => string): T[] {
  const had = new Set(previous.map(key));
  return next.filter((x) => !had.has(key(x)));
}

function change<T>(from: T, to: T, loosened: boolean): SettingChange<T> | null {
  return from === to ? null : { from, to, loosened };
}

const text = (s: string) => canonicalText(s.trim());

export function diffRings(before: Ring | null, after: Ring): RingDiff {
  const policyChanges: PolicyChange[] = [];
  if (before !== null) {
    for (const key of POLICY_KEYS) {
      const from = before.policy[key];
      const to = after.policy[key];
      if (from !== to)
        policyChanges.push({ key, from, to, loosened: rankMode(to) < rankMode(from) });
    }
  }
  const oldMembers = before?.members ?? [];
  const oldRules = before?.fieldRules ?? [];
  const oldTokens = before?.attachments.tokens ?? [];
  const oldExempt = before?.attachments.exemptExtensions ?? [];
  return {
    revRelation: relation(before, after),
    addedMembers: added(oldMembers, after.members, memberKey),
    removedMembers: added(after.members, oldMembers, memberKey),
    policyChanges,
    internalDomainChange:
      before === null
        ? null
        : change(
            before.internalDomain,
            after.internalDomain,
            INTERNAL_RANK[after.internalDomain] < INTERNAL_RANK[before.internalDomain],
          ),
    firstTimeCheckChange:
      before === null
        ? null
        : change(
            before.firstTimeCheck,
            after.firstTimeCheck,
            before.firstTimeCheck && !after.firstTimeCheck,
          ),
    addedFieldRules: added(oldRules, after.fieldRules, ruleKey),
    removedFieldRules: added(after.fieldRules, oldRules, ruleKey),
    addedTokens: added(oldTokens, after.attachments.tokens, text),
    removedTokens: added(after.attachments.tokens, oldTokens, text),
    addedExemptExtensions: added(oldExempt, after.attachments.exemptExtensions, text),
    removedExemptExtensions: added(after.attachments.exemptExtensions, oldExempt, text),
    ignoreInlineChange:
      before === null
        ? null
        : change(
            before.attachments.ignoreInline,
            after.attachments.ignoreInline,
            !before.attachments.ignoreInline && after.attachments.ignoreInline,
          ),
  };
}
