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
export { isRingExpired } from "./expiry";
export {
  DEFAULT_POLICY,
  STRICT_POLICY,
  applyFloor,
  mergePolicy,
  rankMode,
  stricter,
} from "./policy";
export { acknowledgementKey, computeFingerprint } from "./fingerprint";
export { createEvaluate } from "./evaluate";
export { diffRings } from "./diff";
export {
  BEGIN_MARKER,
  END_MARKER,
  MAX_BODY_CHARS,
  MAX_INFLATED_BYTES,
  createCodec,
  keyIdOf,
  type Codec,
  type CodecMeta,
  type CodecOptions,
  type KeyMaterial,
  type KeyProvider,
} from "./codec";
export {
  createBuildTimeDomainProvider,
  createLicensedKeyProvider,
  hashDomain,
  type BuildTimeDomainOptions,
  type LicenseProfile,
  type LicenseProvider,
  type LicenseReason,
  type LicenseResult,
  type LicensedKeysOptions,
} from "./license";
export {
  parseAuthenticationResults,
  verifyImportSource,
  type AuthenticationVerdict,
  type ImportSourceCheck,
  type ImportSourceInput,
  type ImportWarning,
} from "./importVerify";
export {
  HeartbeatPayloadSchema,
  buildHeartbeat,
  hashMailbox,
  shouldSendHeartbeat,
  type HeartbeatError,
  type HeartbeatInput,
  type HeartbeatPayload,
} from "./heartbeat";
export { createSuggestRing, externalAddresses } from "./suggest";
