// The real core, assembled step by step: functions implemented so far replace the fallback's
// (the fixture-backed stub) while signatures stay those of `CoreApi`. Only the share-code codec
// (`encodeRing`, `decodeRing`, CL-05B) still comes from the fallback.
import type { CoreApi } from "./api";
import { diffRings } from "./diff";
import { createEvaluate } from "./evaluate";
import { detectFieldRuleConflicts } from "./fieldRules";
import { findShadowedPatterns, sortRecipients } from "./order";
import { mergePolicy } from "./policy";
import { createSuggestRing } from "./suggest";

export interface CreateCoreOptions {
  readonly fallback: CoreApi;
  /** Clock for ring expiry, the learning window and the look-alike reference set. */
  readonly now?: () => Date;
}

export function createCore({ fallback, now = () => new Date() }: CreateCoreOptions): CoreApi {
  return {
    ...fallback,
    evaluate: createEvaluate(now),
    sortRecipients,
    findShadowedPatterns,
    detectFieldRuleConflicts,
    mergePolicy,
    diffRings,
    suggestRing: createSuggestRing(now),
  };
}
