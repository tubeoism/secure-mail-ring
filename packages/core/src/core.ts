// The real core, assembled step by step: functions implemented so far replace the fallback's
// (the fixture-backed stub) while signatures stay those of `CoreApi`. Only the share-code codec
// share-code codec is real only when the caller supplies keys (CL-05B); without them
// `encodeRing` and `decodeRing` still come from the fallback.
import type { CoreApi } from "./api";
import { createCodec, type KeyProvider } from "./codec";
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
  /** Keys of the share-code codec. Without them the fallback codec is used (mocks, dev server). */
  readonly keys?: KeyProvider;
}

export function createCore({ fallback, now = () => new Date(), keys }: CreateCoreOptions): CoreApi {
  const codec = keys === undefined ? null : createCodec({ keys, now });
  return {
    ...fallback,
    ...(codec === null ? {} : { encodeRing: codec.encodeRing, decodeRing: codec.decodeRing }),
    evaluate: createEvaluate(now),
    sortRecipients,
    findShadowedPatterns,
    detectFieldRuleConflicts,
    mergePolicy,
    diffRings,
    suggestRing: createSuggestRing(now),
  };
}
