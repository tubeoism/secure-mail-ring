# CL-05C — Harden the acknowledgement key and the fingerprint token (advisory review of PR #19)

| Field | Value |
|---|---|
| Owner | Claude Code |
| Stage | S1 (follow-up to CL-05) |
| Status | In QA |
| Depends on | CL-05 (Done), CL-05B (Done, PR #28) |
| Contract | `contract-v1` (no change to `CoreApi`); `acknowledgementKey` and `computeFingerprint` are additive exports of CL-05 and have no consumer yet |
| Plan references | `project_plan.md` §3 (mode Acknowledge), CL-05 D7 |
| Estimate | 0.25 day |

## Goal
Close the two Minor findings and the three Info items of the Antigravity advisory review of PR #19 (record: `docs/agents/advisory-review-pr19.md`), before CL-08 starts to store and verify acknowledgement keys. The PO approved the follow-up in the project thread on 2026-11-05 ("OK").

## Allowed paths
- `packages/core/src/fingerprint.ts`, `packages/core/src/evaluate.ts` (call site only)
- `packages/core/test/fingerprint.test.ts`, `packages/core/test/evaluate.test.ts`, `packages/core/test/lookalike.test.ts`
- `docs/tasks/CL-05C.md`, `docs/tasks/CL-05.md` (D7 wording), `docs/tasks/BOARD.md`, `docs/tasks/changelog/**`
- `docs/agents/advisory-review-pr19.md`, `docs/agents/delegation-log.md`

## Findings and decisions
Each finding was re-checked against the code on `main` (5759def) before it went into this card.

| # | Finding | Re-check | Decision |
|---|---|---|---|
| M-1 | The key hashes `kind`, `field`, `subject` only, not the finding's `messageKey`. | Real. Two field rules of different type on the same address and field (for example `mustBeIn` and `mustNotBeIn`) give the same key, so one tick covers both. Low impact: both sit in the same fingerprint. | Add `messageKey` to the hashed parts; prefix `ak1:` → `ak2:`. Safe now: no code stores a key yet. |
| M-2 | `recipientToken` marks an unresolved entry with a leading `?`; a resolved address whose local part starts with `?` can produce the same token. | Real but contrived: needs a display name equal to such an address. | Distinct shapes: `[field, "a", address]` and `[field, "u", name]`. Bump fingerprint `v` 1 → 2. |
| I-1 | No test pins the mail-without-ring behaviour for sub-domains (`a@sub.tunt.pro` when the sender is `me@tunt.pro`). | Behaviour is "exact sender-domain match" (CL-05 D-05). Untested. | Add the test; no code change. |
| I-2 | Two unresolved recipients with the same display name share one key. | Intended (the name is all there is); only undocumented. | Say so in CL-05 D7. |
| I-3 | `packages/core/test/lookalike.test.ts:229` uses the real domain `fpt.vn`. | True. AGENTS.md §8 keeps real allowed domains out of the repository; a test value that is a real domain invites copying. | Replace with an invented domain. |

## Requirements
1. `acknowledgementKey(fingerprint, finding)` takes `Pick<Finding, "kind" | "field" | "subject" | "messageKey">`, hashes `[fingerprint, kind, field | null, subject, messageKey]`, prefix `ak2:`, still 32 hex.
2. `computeFingerprint` uses the distinct recipient shapes and `v: 2`.
3. `evaluate.ts` passes the whole finding (already does); no behaviour change.
4. Tests for I-1; update the expectations of the key prefix and add: two fieldRule findings that differed only in `messageKey` get different keys; an unresolved recipient whose display name is `a@x.vn` and a resolved recipient `?a@x.vn` (the pair that collides today) get different fingerprints.
5. CL-05 D7 text updated (`ak2`, `v: 2`, I-2).

## Acceptance criteria
- [x] AC-1 M-1: `fingerprint.test.ts` > "depends on the fingerprint, kind, field, subject and message key". Failed on `main` (`ak1` key identical with another `messageKey`), passes now.
- [x] AC-2 M-2: `fingerprint.test.ts` > "tells an unresolved name from a resolved address that starts with a question mark (M-2)". Failed on `main` (equal fingerprints), passes now.
- [x] AC-3 I-1: `evaluate.test.ts` > "treats only the sender's exact domain as internal without a ring (I-1)", green on the unchanged code.
- [x] AC-4 I-3: `lookalike.test.ts:229` now uses `qzt.vn` / `qzu.vn`; `grep` for `fpt.vn` finds nothing.
- [x] AC-5 `npm run verify` passes (594 tests); line coverage of `packages/core` 100 %; mutation score of `fingerprint.ts` 88.89 % (the 5 survivors are equivalent mutants of the sort comparator); `evaluate.contract.test.ts` unchanged and green. The CI `mutation` job runs the whole package.

## Notes
- Two golden tests pin the fingerprint and key values of a sample mail, so a later change that would orphan stored acknowledgements fails loudly.
- The delegation-log row of the PR #19 review was replaced by the detailed row of the six narrow jobs (supplied by the CL-05B thread).

## Edge cases
- The unresolved recipient without a display name falls back to the raw address text (unchanged).
- Existing property test "injective on small distinct mails" must still pass with `v: 2`.

## Out of scope
Persisting or verifying acknowledgement keys (CL-08); the `RingDiff` gap G-1 (contract-v2).

## Evidence required
- Failing-then-passing output for AC-1 and AC-2, `verify` result, coverage and mutation numbers.
