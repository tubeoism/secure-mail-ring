# CL-04B — Registrable-domain heuristic for national sub-domains (finding F-1)

| Field | Value |
|---|---|
| Owner | Claude Code |
| Stage | S1 (fix to CL-04) |
| Status | In progress |
| Depends on | CL-04 (Done) |
| Contract | `contract-v1` (no signature changes) |
| Plan references | `project_plan.md` §3 F6 (FR-6.1 to 6.5) |
| Estimate | 0.5 day |

## Goal
A recipient on a national sub-domain such as `abccorp.id.vn` is compared with the trusted domain `abccorp.vn` and flagged as a look-alike, and two unrelated organisations under `id.vn` or `io.vn` are no longer treated as one trusted domain. Finding F-1 of the advisory review of PRs #9 and #10 (`docs/agents/advisory-review-pr9-pr10.md`). PO approved the fix in the project thread on 2026-11-05 ("Ok").

## Allowed paths
- `packages/core/src/lookalike.ts`
- `packages/core/test/lookalike.test.ts`
- `docs/tasks/CL-04B.md`, `docs/tasks/BOARD.md`, `docs/agents/delegation-log.md`

## Inputs (read-only)
- `splitRegistrable` and `findLookalikes` as merged in PR #10.
- The advisory finding: `splitRegistrable` knew only the second levels `com net org gov edu ac co or ne go`, so `abc.id.vn` and `evil.id.vn` both became registrable `id.vn`, and `abccorp.id.vn` got the primary label `id` and was never compared with `abccorp.vn`.

## Requirements
1. `splitRegistrable` also treats these second levels as part of the suffix, per country code, in addition to the generic set: `vn`: `biz info name pro health int id io`; `uk`: `ltd plc me sch`; `au`: `id asn`; `jp`: `ad ed gr lg`; `kr`: `re pe`. A country-specific second level does not apply under other country codes.
2. No signature change. Domains that were split correctly before are split the same way.
3. Known limit stays documented in the code: there is no public suffix list, and provincial names under `.vn` (for example `hanoi.vn`) are not handled.

## Acceptance criteria
- [ ] AC-1 `splitRegistrable` returns the expected primary and suffix for each added second level and for a deeper host (`mail.abc.id.vn`).
- [ ] AC-2 Country-specific second levels do not leak: `abc.biz.uk`, `abc.ltd.vn` and `abc.id.uk` keep the old split.
- [ ] AC-3 `findLookalikes` flags `x@abccorp.id.vn` (rule `suffix`) against the ring domain `abccorp.vn`, and flags `x@trusted1.id.vn` against `trusted.id.vn` (rule `editDistance`); it does not flag `x@evil.id.vn` against `trusted.id.vn`, and does not flag the trusted domain itself.
- [ ] AC-4 All existing tests still pass; line coverage of `packages/core` stays at or above 90 %; mutation score of `lookalike.ts` at or above 80 % (reported in the PR).
- [ ] AC-5 Advisory review by Antigravity through the job runner in plan mode, recorded in the PR.

## Edge cases
- `id.vn` itself (two labels) is unchanged: it is a suffix, not a registrable name.
- An address under `io.it` is not affected: `io` is listed only under `vn`.

## Out of scope
- The other findings of the advisory review (F-2 to F-8). F-4 (helper for invalid field-rule patterns) and F-6 (local part cap) need a separate approval because they add API surface or change parsing.
- A full public suffix list.

## Evidence required
- Tests: `packages/core/test/lookalike.test.ts`.
- Coverage and mutation report in the PR description.

## Notes
Written 2026-11-05 after the PO approved the F-1 fix in the thread.
