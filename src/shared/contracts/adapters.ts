// The only ways app code touches Outlook or storage (AGENTS.md section 3). No Office.* or DOM
// types appear here; every method returns a Result, never throws.
import type {
  AttachmentInfo,
  ComposeSnapshot,
  FieldName,
  GlobalSettings,
  HistoryState,
  RecipientEntry,
  Result,
  Ring,
} from "@smr/core";
import type { I18nKey } from "./i18nKeys";

export interface AdapterError {
  readonly code: "unsupported" | "denied" | "failed";
  readonly messageKey: I18nKey;
}

export interface NewMessageDraft {
  readonly to: readonly string[];
  readonly subject: string;
  readonly body: string;
}

export type OfficeResult<T> = Promise<Result<T, AdapterError>>;

export interface OfficeAdapter {
  /** Everything the rule engine needs about the item being composed, in one call. */
  getSnapshot(): OfficeResult<ComposeSnapshot>;
  getRecipients(field: FieldName): OfficeResult<readonly RecipientEntry[]>;
  setRecipients(field: FieldName, entries: readonly RecipientEntry[]): OfficeResult<void>;
  getSubject(): OfficeResult<string>;
  setSubject(subject: string): OfficeResult<void>;
  /** Names only; attachment content is never read (FR-4.8). */
  getAttachments(): OfficeResult<readonly AttachmentInfo[]>;
  getFromAddress(): OfficeResult<string>;
  getUserAddress(): OfficeResult<string>;
  getSessionData(key: string): OfficeResult<string | null>;
  setSessionData(key: string, value: string): OfficeResult<void>;
  getCustomProperty(key: string): OfficeResult<string | null>;
  setCustomProperty(key: string, value: string): OfficeResult<void>;
  /** Opens a new message form for the user to review; never sends. */
  displayNewMessage(draft: NewMessageDraft): OfficeResult<void>;
  /** Read mode (D-15): plain-text body and raw internet headers of the open message. */
  getReadBody(): OfficeResult<string>;
  getInternetHeaders(): OfficeResult<string>;
  showNotification(
    messageKey: I18nKey,
    params?: Readonly<Record<string, string>>,
  ): OfficeResult<void>;
}

export interface StorageError {
  readonly code: "quota" | "failed" | "corrupt";
  readonly messageKey: I18nKey;
}

export interface StorageUsage {
  readonly usedBytes: number;
  readonly budgetBytes: number;
}

export type StorageResult<T> = Promise<Result<T, StorageError>>;

export interface StorageAdapter {
  loadRings(): StorageResult<readonly Ring[]>;
  saveRings(rings: readonly Ring[]): StorageResult<void>;
  loadSettings(): StorageResult<GlobalSettings>;
  saveSettings(settings: GlobalSettings): StorageResult<void>;
  loadHistory(): StorageResult<HistoryState | null>;
  saveHistory(history: HistoryState): StorageResult<void>;
  usage(): StorageResult<StorageUsage>;
}
