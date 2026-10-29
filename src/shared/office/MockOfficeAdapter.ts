// In-memory OfficeAdapter for browser development and tests. Seeded from a ComposeSnapshot;
// every write is recorded in `calls` so tests can assert what the app asked Outlook to do.
import { err, ok, type ComposeSnapshot, type FieldName, type RecipientEntry } from "@smr/core";
import type { NewMessageDraft, OfficeAdapter, OfficeResult } from "../contracts/adapters";

export interface MockCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

export interface MockOfficeOptions {
  readonly userAddress?: string;
  readonly readBody?: string;
  readonly internetHeaders?: string;
  /** Method names that should fail with `failed`, to exercise error states. */
  readonly failing?: readonly string[];
}

export class MockOfficeAdapter implements OfficeAdapter {
  readonly calls: MockCall[] = [];
  readonly drafts: NewMessageDraft[] = [];
  private state: { -readonly [K in keyof ComposeSnapshot]: ComposeSnapshot[K] };
  private readonly session = new Map<string, string>();
  private readonly props = new Map<string, string>();

  constructor(
    snapshot: ComposeSnapshot,
    private readonly options: MockOfficeOptions = {},
  ) {
    this.state = structuredClone(snapshot);
  }

  private run<T>(method: string, args: readonly unknown[], fn: () => T): OfficeResult<T> {
    this.calls.push({ method, args });
    if (this.options.failing?.includes(method)) {
      return Promise.resolve(err({ code: "failed", messageKey: "error.adapter.failed" }));
    }
    return Promise.resolve(ok(fn()));
  }

  getSnapshot() {
    return this.run("getSnapshot", [], () => structuredClone(this.state));
  }
  getRecipients(field: FieldName) {
    return this.run("getRecipients", [field], () => structuredClone(this.state[field]));
  }
  setRecipients(field: FieldName, entries: readonly RecipientEntry[]) {
    return this.run("setRecipients", [field, entries], () => {
      this.state[field] = structuredClone([...entries]);
    });
  }
  getSubject() {
    return this.run("getSubject", [], () => this.state.subject);
  }
  setSubject(subject: string) {
    return this.run("setSubject", [subject], () => {
      this.state.subject = subject;
    });
  }
  getAttachments() {
    return this.run("getAttachments", [], () => structuredClone(this.state.attachments));
  }
  getFromAddress() {
    return this.run("getFromAddress", [], () => this.state.from);
  }
  getUserAddress() {
    return this.run("getUserAddress", [], () => this.options.userAddress ?? this.state.from);
  }
  getSessionData(key: string) {
    return this.run("getSessionData", [key], () => this.session.get(key) ?? null);
  }
  setSessionData(key: string, value: string) {
    return this.run("setSessionData", [key, value], () => {
      this.session.set(key, value);
    });
  }
  getCustomProperty(key: string) {
    return this.run("getCustomProperty", [key], () => this.props.get(key) ?? null);
  }
  setCustomProperty(key: string, value: string) {
    return this.run("setCustomProperty", [key, value], () => {
      this.props.set(key, value);
    });
  }
  displayNewMessage(draft: NewMessageDraft) {
    return this.run("displayNewMessage", [draft], () => {
      this.drafts.push(draft);
    });
  }
  getReadBody() {
    return this.run("getReadBody", [], () => this.options.readBody ?? "");
  }
  getInternetHeaders() {
    return this.run("getInternetHeaders", [], () => this.options.internetHeaders ?? "");
  }
  showNotification(messageKey: string, params?: Readonly<Record<string, string>>) {
    return this.run("showNotification", [messageKey, params], () => undefined);
  }
}
