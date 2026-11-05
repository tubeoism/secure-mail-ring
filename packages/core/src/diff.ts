// Difference between the ring on the device and an incoming one (FR-2.6, FR-2.7), for the import
// preview. Members are compared in normal form so a change of case or notation is not shown as a
// removal plus an addition.
import type { PolicyChange, RevRelation, RingDiff } from "./api";
import { compileMember } from "./match";
import { POLICY_KEYS, type Member, type Ring } from "./model";
import { rankMode } from "./policy";

function memberKey(member: Member): string {
  const compiled = compileMember(member);
  return compiled === null
    ? `?${member.kind}:${member.value}`
    : `${compiled.kind}:${compiled.value}`;
}

function relation(before: Ring | null, after: Ring): RevRelation {
  if (before === null) return "new";
  if (after.rev > before.rev) return "newer";
  return after.rev === before.rev ? "same" : "older";
}

export function diffRings(before: Ring | null, after: Ring): RingDiff {
  const had = new Set((before?.members ?? []).map(memberKey));
  const has = new Set(after.members.map(memberKey));
  const policyChanges: PolicyChange[] = [];
  if (before !== null) {
    for (const key of POLICY_KEYS) {
      const from = before.policy[key];
      const to = after.policy[key];
      if (from !== to)
        policyChanges.push({ key, from, to, loosened: rankMode(to) < rankMode(from) });
    }
  }
  return {
    revRelation: relation(before, after),
    addedMembers: after.members.filter((m) => !had.has(memberKey(m))),
    removedMembers: (before?.members ?? []).filter((m) => !has.has(memberKey(m))),
    policyChanges,
  };
}
