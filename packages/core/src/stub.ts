// Fixture-backed stand-in for the real core (decision D4 of CL-02). Results are canned or
// trivially derived so that UI work does not wait for CL-03 to CL-05. Not a reference
// implementation: do not copy its logic into product code.
import type { CodecError, CoreApi, PolicyChange, RingDiff } from "./api";
import {
  err,
  ok,
  POLICY_KEYS,
  POLICY_MODES,
  type ComposeSnapshot,
  type EvaluationResult,
  type FieldName,
  type Mutation,
  type Policy,
  type Ring,
  type ShareCodePayload,
} from "./model";

export interface StubData {
  /** Canned evaluations, matched by deep equality of the snapshot. */
  readonly evaluations: readonly {
    readonly snapshot: ComposeSnapshot;
    readonly result: EvaluationResult;
  }[];
  /** Canned share codes; whitespace is ignored when matching, as FR-2.2 requires. */
  readonly shareCodes: readonly { readonly code: string; readonly payload: ShareCodePayload }[];
}

const EMPTY: EvaluationResult = {
  findings: [],
  mutations: [],
  verdict: "allow",
  fingerprint: "stub",
};
const strip = (s: string) => s.replace(/\s+/g, "");
const rank = (m: Policy[keyof Policy]) => POLICY_MODES.indexOf(m);
const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();

export function createStubCore(data: StubData): CoreApi {
  return {
    evaluate({ snapshot }) {
      const wanted = JSON.stringify(snapshot);
      return data.evaluations.find((e) => JSON.stringify(e.snapshot) === wanted)?.result ?? EMPTY;
    },

    sortRecipients(_ring, snapshot) {
      const fields: FieldName[] = ["to", "cc", "bcc"];
      const sorted = fields.map((field): Mutation => ({
        field,
        entries: [...snapshot[field]].sort((a, b) => a.address.localeCompare(b.address)),
      }));
      return sorted.filter((m, i) =>
        m.entries.some((e, j) => e !== snapshot[fields[i] as FieldName][j]),
      );
    },

    findShadowedPatterns(order) {
      const out: { shadowed: string; by: string }[] = [];
      order.forEach((later, i) => {
        const by = order
          .slice(0, i)
          .find((p) => !p.includes("@") && p !== "*" && later.endsWith(`@${p}`));
        if (by !== undefined) out.push({ shadowed: later, by });
      });
      return out;
    },

    detectFieldRuleConflicts(rules) {
      const out: { a: (typeof rules)[number]; b: (typeof rules)[number] }[] = [];
      rules.forEach((a, i) => {
        for (const b of rules.slice(i + 1)) {
          const opposed =
            (a.type === "mustBeIn" && b.type === "mustNotBeIn") ||
            (a.type === "mustNotBeIn" && b.type === "mustBeIn");
          if (opposed && a.pattern === b.pattern && a.field === b.field) out.push({ a, b });
        }
      });
      return out;
    },

    mergePolicy(ring, settings) {
      const merged = { ...ring.policy };
      for (const key of POLICY_KEYS) {
        const floor = settings.policyFloor[key];
        if (floor !== undefined && rank(floor) > rank(merged[key])) merged[key] = floor;
      }
      return merged;
    },

    diffRings(before, after): RingDiff {
      const id = (m: Ring["members"][number]) => `${m.kind}:${m.value}`;
      const had = new Set((before?.members ?? []).map(id));
      const has = new Set(after.members.map(id));
      const policyChanges: PolicyChange[] = [];
      if (before) {
        for (const key of POLICY_KEYS) {
          const from = before.policy[key];
          const to = after.policy[key];
          if (from !== to) policyChanges.push({ key, from, to, loosened: rank(to) < rank(from) });
        }
      }
      return {
        revRelation:
          before === null
            ? "new"
            : after.rev > before.rev
              ? "newer"
              : after.rev === before.rev
                ? "same"
                : "older",
        addedMembers: after.members.filter((m) => !had.has(id(m))),
        removedMembers: (before?.members ?? []).filter((m) => !has.has(id(m))),
        policyChanges,
      };
    },

    async encodeRing(ring) {
      const hit = data.shareCodes.find((c) => c.payload.ring.id === ring.id);
      return hit ? ok(hit.code) : err<CodecError>({ code: "unsupported" });
    },

    async decodeRing(code) {
      const hit = data.shareCodes.find((c) => strip(c.code) === strip(code));
      return hit ? ok(hit.payload) : err<CodecError>({ code: "malformed" });
    },

    suggestRing(rings, snapshot) {
      const first = snapshot.to[0] ?? snapshot.cc[0] ?? snapshot.bcc[0];
      if (!first) return null;
      const domain = domainOf(first.address);
      return (
        rings.find((r) =>
          r.members.some(
            (m) =>
              m.value.toLowerCase() === domain ||
              m.value.toLowerCase() === first.address.toLowerCase(),
          ),
        )?.id ?? null
      );
    },
  };
}
