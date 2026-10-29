// The real core, assembled step by step: functions implemented so far replace the fallback's
// (the fixture-backed stub) while signatures stay those of `CoreApi`. CL-04 and CL-05 add more.
import type { CoreApi } from "./api";
import { detectFieldRuleConflicts } from "./fieldRules";
import { findShadowedPatterns, sortRecipients } from "./order";

export interface CreateCoreOptions {
  readonly fallback: CoreApi;
}

export function createCore({ fallback }: CreateCoreOptions): CoreApi {
  return { ...fallback, sortRecipients, findShadowedPatterns, detectFieldRuleConflicts };
}
