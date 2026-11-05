# CL-04C — Stop the Stryker dry run from timing out on the Bloom tests

| Field | Value |
|---|---|
| Owner | Claude Code |
| Stage | S1 (fix to CL-04 test setup) |
| Status | In QA |
| Depends on | CL-04 (Done) |
| Contract | `contract-v1` (no change) |
| Plan references | `CLAUDE.md` compensating controls (mutation score ≥ 80 %), `AGENTS.md` §6 (verify) |
| Estimate | 0.25 day |

## Goal
The `mutation` job of CI stops failing before it runs a single mutant. Its initial dry run aborts when one existing test exceeds Vitest's default 5,000 ms timeout; the PO asked for the fix in the project thread on 2026-11-05 ("OK" to the proposal).

## Allowed paths
- `vitest.config.ts`
- `docs/tasks/CL-04C.md`, `docs/tasks/BOARD.md`

## Inputs (read-only)
- CI run 41988066490, job `mutation`: `Bloom filter (FR-7.1, FR-7.4) has no false negatives for the most recent 1,500 addresses (property)` timed out in 5,000 ms; Stryker then stops with "There were failed tests in the initial test run".
- The same job is red on `main` and on unrelated branches since CL-04 (runs 45, 46, 49, and the merge of #19).

## Requirements
1. Set `test.testTimeout` to 30,000 ms in `vitest.config.ts`, with a comment saying why. No test is skipped, shortened or changed.

## Acceptance criteria
- [x] AC-1 Root cause shown. Evidence: with `--testTimeout=200` the Bloom property test and the 3,000-address false-positive test fail with "Test timed out in 200ms" locally (about 430 ms and 250 ms uninstrumented), which is the CI failure at a different scale.
- [ ] AC-2 `npm run verify` passes and the `mutation` job of this PR is green on the CI runner.
- [x] AC-3 No test, source file or dependency changed; mutation score unchanged (the run is the same code).

## Edge cases
- A real hang would now show after 30 s instead of 5 s. Acceptable: the whole suite takes about 5 s, and a hang still fails.

## Out of scope
Making the Bloom hash faster, or splitting the heavy tests.

## Evidence required
- The `mutation` check of the PR.

## Notes
Written and implemented 2026-11-05 on the PO message "OK". AC-2 is ticked when CI is green on the PR head.
