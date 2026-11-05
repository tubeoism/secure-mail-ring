// Builders shared by the decision-engine tests. All data is fictional.
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
