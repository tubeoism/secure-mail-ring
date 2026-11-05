// CL-05 AC-8: the real engine against the canned evaluations of contract-v1. A fixture is the
// shape the UI was built against, so every fixture finding must appear in the real result with the
// same kind, key, subject, field and parameter names. The published fixtures are not edited after
// the `contract-v1` tag; where a fixture is a simplification of what the engine really reports, the
// difference is listed here with its reason, and nothing else may differ.
import { describe, expect, it } from "vitest";
import { createCore, emptyHistory, recordAddresses, type Finding } from "@smr/core";
import { fixtures, stubCore } from "./index";

const NOW = new Date("2026-11-05T00:00:00Z");
const core = createCore({ fallback: stubCore, now: () => NOW });

interface Deviation {
  /** Findings the engine reports that the fixture leaves out, as `kind:subject`. */
  readonly extra?: readonly string[];
  /** The fixture shows a mode that its ring and the fixture settings do not produce. */
  readonly mode?: string;
  /** The fixture's subject text differs from the compose address (typed by hand). */
  readonly subject?: string;
}

const DEVIATIONS: Record<string, Deviation> = {
  "lookalike-domain": { extra: ["outsider:cfo@abcc0rp.vn"] },
  "cyrillic-homograph": {
    extra: ["outsider:cfo@аbccorp.vn"],
    mode: "fixture shows Block, ring Alpha says Warn",
    subject: "fixture subject is the ASCII look-alike, compose uses the Cyrillic letter",
  },
  "field-rule-violation": {
    extra: ["fieldRule:partner@auditfirm.vn"],
    mode: "fixture shows Acknowledge, ring Delta says Warn",
  },
};

const sig = (f: Finding, withSubject = true) =>
  JSON.stringify([
    f.kind,
    f.messageKey,
    withSubject ? f.subject : null,
    f.field ?? null,
    Object.keys(f.params).sort(),
  ]);

describe("evaluate against the contract fixtures", () => {
  for (const { compose, result } of fixtures.evaluations) {
    it(compose, () => {
      const deviation = DEVIATIONS[compose] ?? {};
      const snapshot = fixtures.composeByName(compose);
      const ring = fixtures.rings.find((r) => r.id === snapshot.ringId) ?? null;
      const everyone = [...snapshot.to, ...snapshot.cc, ...snapshot.bcc].map((e) => e.address);
      // Only the first-time fixture is meant to meet a stranger.
      const known = compose === "first-time-recipient" ? [] : everyone;
      const real = core.evaluate({
        ring,
        allRings: fixtures.rings,
        settings: { ...fixtures.settings, learning: { enabled: false, until: null } },
        snapshot,
        history: recordAddresses(emptyHistory("fixture"), known),
        acknowledged: [],
      });
      const withSubject = deviation.subject === undefined;
      const realSigs = real.findings.map((f) => sig(f, withSubject));
      for (const expected of result.findings) {
        expect(realSigs).toContain(sig(expected, withSubject));
        if (deviation.mode === undefined) {
          const match = real.findings.find(
            (f) => sig(f, withSubject) === sig(expected, withSubject),
          );
          expect(match?.mode).toBe(expected.mode);
        }
      }
      const fixtureSigs = new Set(result.findings.map((f) => sig(f, withSubject)));
      const extras = real.findings
        .filter((f) => !fixtureSigs.has(sig(f, withSubject)))
        .map((f) => `${f.kind}:${f.subject}`);
      expect(extras).toEqual(deviation.extra ?? []);
      if (deviation.mode === undefined && deviation.extra === undefined) {
        expect(real.verdict).toBe(result.verdict);
      }
    });
  }
});
