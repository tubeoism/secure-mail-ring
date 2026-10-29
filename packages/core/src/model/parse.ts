import * as v from "valibot";
import { err, ok, type Result } from "./result";
import {
  ComposeSnapshotSchema,
  HistorySchema,
  RingSchema,
  SettingsSchema,
  ShareCodePayloadSchema,
  type ComposeSnapshot,
  type GlobalSettings,
  type HistoryState,
  type Ring,
  type ShareCodePayload,
} from "./schema";

export interface ParseError {
  readonly code: "invalid";
  /** Dotted path of the first offending field, e.g. `members.3.kind`; empty for the root. */
  readonly path: string;
  readonly message: string;
}

function parseWith<S extends v.GenericSchema>(
  schema: S,
  input: unknown,
): Result<v.InferOutput<S>, ParseError> {
  try {
    const r = v.safeParse(schema, input);
    if (r.success) return ok(r.output);
    const issue = r.issues[0];
    const path = (issue?.path ?? []).map((p) => String(p.key)).join(".");
    return err({ code: "invalid", path, message: issue?.message ?? "invalid input" });
  } catch {
    // Hostile input (getters that throw, proxies) must not escape as an exception.
    return err({ code: "invalid", path: "", message: "unreadable input" });
  }
}

export const parseRing = (input: unknown): Result<Ring, ParseError> => parseWith(RingSchema, input);
export const parseSettings = (input: unknown): Result<GlobalSettings, ParseError> =>
  parseWith(SettingsSchema, input);
export const parseComposeSnapshot = (input: unknown): Result<ComposeSnapshot, ParseError> =>
  parseWith(ComposeSnapshotSchema, input);
export const parseShareCodePayload = (input: unknown): Result<ShareCodePayload, ParseError> =>
  parseWith(ShareCodePayloadSchema, input);
export const parseHistory = (input: unknown): Result<HistoryState, ParseError> =>
  parseWith(HistorySchema, input);
