// Data model `smr/1` (plan section 5.3). Valibot schemas are the single source of truth;
// the exported types are inferred from them. Everything parsed here is untrusted input.
import * as v from "valibot";

export const SCHEMA_ID = "smr/1";

export const POLICY_MODES = ["warn", "acknowledge", "block"] as const;
export const POLICY_KEYS = [
  "outsider",
  "missingToken",
  "foreignRingToken",
  "lookalike",
  "firstTime",
  "fieldRule",
] as const;
export const FIELD_NAMES = ["to", "cc", "bcc"] as const;
export const MEMBER_KINDS = ["address", "domain", "subdomains"] as const;
export const RULE_TYPES = ["mustBeIn", "mustNotBeIn", "onlyIn"] as const;
export const LANGUAGES = ["vi", "en"] as const;

/** Upper bounds keep a hostile import from exhausting memory or roamingSettings. */
export const LIMITS = {
  members: 500,
  orderEntries: 200,
  tokens: 50,
  exemptExtensions: 20,
  fieldRules: 50,
  lookalikeExceptions: 200,
  text: 254,
} as const;

const text = (max: number = LIMITS.text) => v.pipe(v.string(), v.maxLength(max));

export const PolicyModeSchema = v.picklist(POLICY_MODES);
export const PolicyKeySchema = v.picklist(POLICY_KEYS);
export const FieldNameSchema = v.picklist(FIELD_NAMES);
export const LanguageSchema = v.picklist(LANGUAGES);

export const MemberSchema = v.strictObject({
  kind: v.picklist(MEMBER_KINDS),
  value: v.pipe(text(), v.minLength(1)),
});

export const FieldRuleSchema = v.strictObject({
  pattern: v.pipe(text(), v.minLength(1)),
  type: v.picklist(RULE_TYPES),
  field: FieldNameSchema,
  when: v.optional(v.literal("anyExternal")),
});

export const PolicySchema = v.strictObject({
  outsider: PolicyModeSchema,
  missingToken: PolicyModeSchema,
  foreignRingToken: PolicyModeSchema,
  lookalike: PolicyModeSchema,
  firstTime: PolicyModeSchema,
  fieldRule: PolicyModeSchema,
});

const orderList = v.pipe(v.array(text()), v.maxLength(LIMITS.orderEntries));

export const RingSchema = v.strictObject({
  schema: v.literal(SCHEMA_ID),
  id: v.pipe(text(64), v.minLength(1)),
  rev: v.pipe(v.number(), v.integer(), v.minValue(1)),
  name: v.pipe(text(), v.minLength(1)),
  subjectTag: text(64),
  owner: text(),
  updatedAt: text(40),
  members: v.pipe(v.array(MemberSchema), v.maxLength(LIMITS.members)),
  internalDomain: v.picklist(["allow", "warn", "outsider"]),
  order: v.strictObject({ to: orderList, cc: orderList, bcc: orderList }),
  attachments: v.strictObject({
    tokens: v.pipe(v.array(text(64)), v.maxLength(LIMITS.tokens)),
    mode: v.literal("any"),
    ignoreInline: v.boolean(),
    exemptExtensions: v.pipe(v.array(text(16)), v.maxLength(LIMITS.exemptExtensions)),
  }),
  policy: PolicySchema,
  fieldRules: v.pipe(v.array(FieldRuleSchema), v.maxLength(LIMITS.fieldRules)),
  firstTimeCheck: v.boolean(),
  expiresAt: v.nullable(text(40)),
});

export const SettingsSchema = v.strictObject({
  schema: v.literal(SCHEMA_ID),
  /** Global floor: no ring may set a violation kind below this mode (plan section 3). */
  policyFloor: v.partial(PolicySchema),
  lookalikeExceptions: v.pipe(
    v.array(v.strictObject({ a: text(), b: text() })),
    v.maxLength(LIMITS.lookalikeExceptions),
  ),
  learning: v.strictObject({ enabled: v.boolean(), until: v.nullable(text(40)) }),
  language: LanguageSchema,
});

export const RecipientEntrySchema = v.strictObject({
  address: text(),
  displayName: text(),
  resolved: v.boolean(),
});

export const AttachmentInfoSchema = v.strictObject({
  name: text(),
  isInline: v.boolean(),
  kind: v.picklist(["file", "item", "cloud"]),
});

export const ComposeSnapshotSchema = v.strictObject({
  from: text(),
  subject: text(998),
  to: v.array(RecipientEntrySchema),
  cc: v.array(RecipientEntrySchema),
  bcc: v.array(RecipientEntrySchema),
  attachments: v.array(AttachmentInfoSchema),
  ringId: v.nullable(text(64)),
});

export const FindingSchema = v.strictObject({
  kind: PolicyKeySchema,
  mode: PolicyModeSchema,
  /** The thing the finding is about: an address, a file name or a rule pattern. */
  subject: text(),
  field: v.optional(FieldNameSchema),
  /** i18n key (validated against the contract key list by the UI layer). */
  messageKey: text(128),
  params: v.record(v.string(), v.string()),
});

export const MutationSchema = v.strictObject({
  field: FieldNameSchema,
  entries: v.array(RecipientEntrySchema),
});

export const VERDICTS = ["allow", "warn", "acknowledge", "block"] as const;

export const EvaluationResultSchema = v.strictObject({
  findings: v.array(FindingSchema),
  mutations: v.array(MutationSchema),
  verdict: v.picklist(VERDICTS),
  /** Hash of recipients plus file names; acknowledgements bind to it (plan section 3). */
  fingerprint: text(128),
});

export const ShareCodePayloadSchema = v.strictObject({
  keyId: text(32),
  ring: RingSchema,
  issuer: text(),
  issuedAt: text(40),
  expiresAt: v.optional(text(40)),
});

/** Bloom filter state for first-time recipients (F7); strings are base64url bit arrays. */
export const HistorySchema = v.strictObject({
  schema: v.literal(SCHEMA_ID),
  salt: text(64),
  current: v.pipe(v.string(), v.maxLength(8192)),
  previous: v.nullable(v.pipe(v.string(), v.maxLength(8192))),
  count: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type PolicyMode = v.InferOutput<typeof PolicyModeSchema>;
export type PolicyKey = v.InferOutput<typeof PolicyKeySchema>;
export type FieldName = v.InferOutput<typeof FieldNameSchema>;
export type Language = v.InferOutput<typeof LanguageSchema>;
export type Member = v.InferOutput<typeof MemberSchema>;
export type FieldRule = v.InferOutput<typeof FieldRuleSchema>;
export type Policy = v.InferOutput<typeof PolicySchema>;
export type Ring = v.InferOutput<typeof RingSchema>;
export type GlobalSettings = v.InferOutput<typeof SettingsSchema>;
export type RecipientEntry = v.InferOutput<typeof RecipientEntrySchema>;
export type AttachmentInfo = v.InferOutput<typeof AttachmentInfoSchema>;
export type ComposeSnapshot = v.InferOutput<typeof ComposeSnapshotSchema>;
export type Finding = v.InferOutput<typeof FindingSchema>;
export type Mutation = v.InferOutput<typeof MutationSchema>;
export type Verdict = (typeof VERDICTS)[number];
export type EvaluationResult = v.InferOutput<typeof EvaluationResultSchema>;
export type ShareCodePayload = v.InferOutput<typeof ShareCodePayloadSchema>;
export type HistoryState = v.InferOutput<typeof HistorySchema>;
