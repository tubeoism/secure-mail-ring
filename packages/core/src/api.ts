// Public function contract of @smr/core. CL-03 to CL-05 implement it; until then the
// fixture-backed `createStubCore` stands in with identical signatures. Changing a
// signature after tag `contract-v1` needs a Contract Change Request.
import type {
  ComposeSnapshot,
  EvaluationResult,
  FieldRule,
  GlobalSettings,
  HistoryState,
  Member,
  Mutation,
  Policy,
  PolicyKey,
  PolicyMode,
  Ring,
  ShareCodePayload,
} from "./model";
import type { Result } from "./model";

export interface EvaluateInput {
  /** Ring bound to the item, or null when the user picked none (FR-1.8). */
  readonly ring: Ring | null;
  readonly allRings: readonly Ring[];
  readonly settings: GlobalSettings;
  readonly snapshot: ComposeSnapshot;
  readonly history: HistoryState;
  /** Fingerprints the user already acknowledged in this session. */
  readonly acknowledged: readonly string[];
}

export interface ShadowWarning {
  /** The pattern that can never match because an earlier one catches everything it would. */
  readonly shadowed: string;
  readonly by: string;
}

export interface RuleConflict {
  readonly a: FieldRule;
  readonly b: FieldRule;
}

export type RevRelation = "new" | "newer" | "same" | "older";

export interface PolicyChange {
  readonly key: PolicyKey;
  readonly from: PolicyMode;
  readonly to: PolicyMode;
  readonly loosened: boolean;
}

export interface RingDiff {
  readonly revRelation: RevRelation;
  readonly addedMembers: readonly Member[];
  readonly removedMembers: readonly Member[];
  readonly policyChanges: readonly PolicyChange[];
}

export interface CodecError {
  readonly code: "malformed" | "tampered" | "expired" | "tooLarge" | "unsupported";
}

export interface CoreApi {
  evaluate(input: EvaluateInput): EvaluationResult;
  /** Pure: returns the mutations to apply; the caller checks the multiset invariant (FR-3.6). */
  sortRecipients(ring: Ring, snapshot: ComposeSnapshot): readonly Mutation[];
  findShadowedPatterns(order: readonly string[]): readonly ShadowWarning[];
  detectFieldRuleConflicts(rules: readonly FieldRule[]): readonly RuleConflict[];
  /** Effective mode per violation kind: the stricter of ring policy and global floor. */
  mergePolicy(ring: Ring, settings: GlobalSettings): Policy;
  diffRings(before: Ring | null, after: Ring): RingDiff;
  encodeRing(
    ring: Ring,
    meta: { readonly issuer: string; readonly issuedAt: string },
  ): Promise<Result<string, CodecError>>;
  decodeRing(code: string): Promise<Result<ShareCodePayload, CodecError>>;
  /** Id of the ring that best matches the recipients, or null (D-05). */
  suggestRing(rings: readonly Ring[], snapshot: ComposeSnapshot): string | null;
}
