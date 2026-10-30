// Public surface of @smr/core. Pure TypeScript: no Office.js, no DOM.
export * from "./model";
export type * from "./api";
export { createStubCore, type StubData } from "./stub";
export { createCore, type CreateCoreOptions } from "./core";
export {
  normalizeAddress,
  normalizeDomain,
  splitAddress,
  domainLabels,
  type AddressError,
  type ParsedAddress,
} from "./normalize";
export { findMatchingMember, findOutsiders, matchMember, type Outsider } from "./match";
export { sameRecipients, sortRecipientsChecked, type InvariantViolation } from "./order";
export {
  checkAttachments,
  tokenMatches,
  type AttachmentCheck,
  type AttachmentStatus,
} from "./attachments";
export {
  findLookalikes,
  skeleton,
  splitRegistrable,
  type LookalikeInput,
  type LookalikeMatch,
  type LookalikeReference,
  type LookalikeRule,
  type Registrable,
} from "./lookalike";
export {
  emptyHistory,
  findFirstTimeRecipients,
  historyStats,
  isLearning,
  mightContain,
  openHistory,
  parseKnownAddresses,
  recordAddresses,
  type FirstTimeInput,
  type FirstTimeRecipient,
  type HistoryReader,
  type HistoryStats,
} from "./history";
export {
  detectFieldRuleConflicts,
  evaluateFieldRules,
  type FieldRuleViolation,
} from "./fieldRules";
