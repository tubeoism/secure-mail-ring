# CL-04D — One change-log file per PR instead of a shared table

| Field | Value |
|---|---|
| Owner | Claude Code |
| Stage | S1 (process fix) |
| Status | In QA |
| Depends on | — |
| Contract | `contract-v1` (no change) |
| Plan references | `AGENTS.md` §4 (board), `CLAUDE.md` responsibility 6 (board hygiene) |
| Estimate | 0.25 day |

## Goal
Parallel PRs stop conflicting on `docs/tasks/BOARD.md`. The PO asked for it in the project thread on 2026-11-05 ("Board.md conflict cho tất cả các PR") and chose the change-log split over `merge=union` ("Dùng changelog nghe có vẻ khả thi hơn").

## Allowed paths
- `docs/tasks/BOARD.md`, `docs/tasks/CHANGELOG.md`, `docs/tasks/changelog/**`, `docs/tasks/CL-04D.md`
- `CLAUDE.md` (one sentence in responsibility 6), `AGENTS.md` §4 (one bullet)

## Requirements
1. Move the existing change-log table out of `BOARD.md` into `docs/tasks/CHANGELOG.md`, unchanged and marked closed.
2. `BOARD.md` keeps a short pointer under "Change log"; the status tables stay in place.
3. `docs/tasks/changelog/README.md` states the rule: one new file per PR, named `YYYY-MM-DD-<ID>.md`, one paragraph, never edit another PR's file.
4. `CLAUDE.md` responsibility 6 and `AGENTS.md` §4 state the same in one sentence each (wording of the AGENTS.md bullet taken from PR #25, which this PR replaces).

## Acceptance criteria
- [x] AC-1 No row of the old change log is lost: 39 data rows on `main` (after CL-04C), the same 39 in `CHANGELOG.md` (sorted `diff` empty).
- [x] AC-2 Two scratch branches each adding a new file under `docs/tasks/changelog/` merge cleanly (`git merge-tree`, exit 0).
- [x] AC-3 `npm run verify` passes.

## Edge cases
- Two PRs changing the same status row of `BOARD.md` can still conflict; the README says to merge them one at a time. Accepted.
- PRs open before this one merges (#21, #23, the CL-05B branch) still append rows to the old section. Each needs one merge of `main`, moving its row into a new file.

## Out of scope
Generating `BOARD.md` from the cards; a script that checks entry file names.

## Evidence required
- Output of AC-1 and AC-2 commands, `verify` result.
