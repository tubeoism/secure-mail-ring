// Builders shared by the decision-engine tests. All data is fictional.
import fc from "fast-check";
import { emptyHistory, recordAddresses } from "../src/history";
import type {
  AttachmentInfo,
  ComposeSnapshot,
  GlobalSettings,
  HistoryState,
  Member,
  RecipientEntry,
  Ring,
} from "../src/model";
import { DEFAULT_POLICY } from "../src/policy";

export const NOW = new Date("2026-11-05T00:00:00Z");

export const entry = (address: string, displayName = "", resolved = true): RecipientEntry => ({
  address,
  displayName,
  resolved,
});

export const file = (name: string, isInline = false): AttachmentInfo => ({
  name,
  isInline,
  kind: "file",
});

export const ring = (over: Partial<Ring> = {}): Ring => ({
  schema: "smr/1",
  id: "r1",
  rev: 1,
  name: "Alpha",
  subjectTag: "[ALPHA]",
  owner: "me@tunt.pro",
  updatedAt: "2026-11-05T00:00:00Z",
  members: [
    { kind: "domain", value: "abccorp.vn" },
    { kind: "address", value: "kt@partner.vn" },
  ],
  internalDomain: "allow",
  order: { to: [], cc: [], bcc: [] },
  attachments: { tokens: ["ALPHA"], mode: "any", ignoreInline: true, exemptExtensions: [] },
  policy: { ...DEFAULT_POLICY },
  fieldRules: [],
  firstTimeCheck: true,
  expiresAt: null,
  ...over,
});

export const members = (...values: string[]): Member[] =>
  values.map((value) =>
    value.includes("@")
      ? { kind: "address", value }
      : value.startsWith("*.")
        ? { kind: "subdomains", value: value.slice(2) }
        : { kind: "domain", value },
  );

export const settings = (over: Partial<GlobalSettings> = {}): GlobalSettings => ({
  schema: "smr/1",
  policyFloor: {},
  lookalikeExceptions: [],
  learning: { enabled: false, until: null },
  language: "en",
  ...over,
});

export const mail = (over: Partial<ComposeSnapshot> = {}): ComposeSnapshot => ({
  from: "me@tunt.pro",
  subject: "s",
  to: [],
  cc: [],
  bcc: [],
  attachments: [],
  ringId: null,
  ...over,
});

/** A history that already knows the given addresses, so first-time findings stay quiet. */
export const knowing = (...addresses: string[]): HistoryState =>
  recordAddresses(emptyHistory("test-salt"), addresses);

export const noHistory = (): HistoryState => emptyHistory("test-salt");

/** Arbitrary valid rings for property tests; `text` chooses the strings (printable by default). */
export function arbRing(
  text: fc.Arbitrary<string> = fc.string({ maxLength: 40 }),
): fc.Arbitrary<Ring> {
  const mode = fc.constantFrom("warn", "acknowledge", "block");
  const word = (min: number, max: number) =>
    text.map((s) => s.slice(0, max)).filter((s) => s.length >= min);
  return fc.record({
    schema: fc.constant("smr/1" as const),
    id: word(1, 40),
    rev: fc.integer({ min: 1, max: 1_000_000 }),
    name: word(1, 80),
    subjectTag: word(0, 20),
    owner: word(0, 80),
    updatedAt: word(0, 30),
    members: fc.array(
      fc.record({
        kind: fc.constantFrom("address", "domain", "subdomains"),
        value: word(1, 60),
      }),
      { maxLength: 30 },
    ),
    internalDomain: fc.constantFrom("allow", "warn", "outsider"),
    order: fc.record({
      to: fc.array(word(0, 40), { maxLength: 10 }),
      cc: fc.array(word(0, 40), { maxLength: 10 }),
      bcc: fc.array(word(0, 40), { maxLength: 10 }),
    }),
    attachments: fc.record({
      tokens: fc.array(word(0, 20), { maxLength: 10 }),
      mode: fc.constant("any" as const),
      ignoreInline: fc.boolean(),
      exemptExtensions: fc.array(word(0, 8), { maxLength: 5 }),
    }),
    policy: fc.record({
      outsider: mode,
      missingToken: mode,
      foreignRingToken: mode,
      lookalike: mode,
      firstTime: mode,
      fieldRule: mode,
    }),
    fieldRules: fc.array(
      fc.record({
        pattern: word(1, 40),
        type: fc.constantFrom("mustBeIn", "mustNotBeIn", "onlyIn"),
        field: fc.constantFrom("to", "cc", "bcc"),
      }),
      { maxLength: 5 },
    ),
    firstTimeCheck: fc.boolean(),
    expiresAt: fc.option(word(0, 30), { nil: null }),
  }) as fc.Arbitrary<Ring>;
}
