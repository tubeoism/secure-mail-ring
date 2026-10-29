// Typed access to the contract-v1 fixtures. All data is fictional (abccorp.vn, partner.vn, ...).
// Each file is validated through @smr/core on load, so a malformed fixture fails fast in tests.
import {
  EvaluationResultSchema,
  FindingSchema,
  parseComposeSnapshot,
  parseRing,
  parseSettings,
  parseShareCodePayload,
  type ComposeSnapshot,
  type EvaluationResult,
  type Finding,
  type GlobalSettings,
  type Ring,
  type ShareCodePayload,
} from "@smr/core";
import * as v from "valibot";
import composeJson from "./compose.json";
import evaluationsJson from "./evaluations.json";
import findingsJson from "./findings.json";
import ringsJson from "./rings.json";
import settingsJson from "./settings.json";
import shareCodesJson from "./sharecodes.json";

function must<T>(
  r: { ok: true; value: T } | { ok: false; error: { path: string; message: string } },
  what: string,
): T {
  if (r.ok) return r.value;
  throw new Error(`fixture ${what} invalid at "${r.error.path}": ${r.error.message}`);
}

export const rings: readonly Ring[] = ringsJson.map((r, i) => must(parseRing(r), `rings[${i}]`));
export const settings: GlobalSettings = must(parseSettings(settingsJson), "settings");
export const findings: readonly Finding[] = v.parse(v.array(FindingSchema), findingsJson);

export interface ComposeFixture {
  readonly name: string;
  readonly snapshot: ComposeSnapshot;
}
export const compose: readonly ComposeFixture[] = composeJson.map((c, i) => ({
  name: c.name,
  snapshot: must(parseComposeSnapshot(c.snapshot), `compose[${i}]`),
}));

const evaluationSchema = v.array(v.object({ compose: v.string(), result: EvaluationResultSchema }));
export const evaluations: readonly {
  readonly compose: string;
  readonly result: EvaluationResult;
}[] = v.parse(evaluationSchema, evaluationsJson);

export const shareCodes: readonly { readonly code: string; readonly payload: ShareCodePayload }[] =
  shareCodesJson.map((c, i) => ({
    code: c.code,
    payload: must(parseShareCodePayload(c.payload), `shareCodes[${i}]`),
  }));

export function composeByName(name: string): ComposeSnapshot {
  const hit = compose.find((c) => c.name === name);
  if (!hit) throw new Error(`unknown compose fixture ${name}`);
  return hit.snapshot;
}
