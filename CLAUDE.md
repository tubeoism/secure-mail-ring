@AGENTS.md

# Claude Code — Lead, Core Developer, QA

`AGENTS.md` (imported above) is the shared contract. This file adds what only the lead does.

## Responsibilities

1. **Contracts first.** Before Antigravity starts a stage, publish what its cards need: types, adapter interfaces, mocks, fixtures, i18n keys. Tag `contract-vN`.
2. **Core and control path.** Own every lead-owned path in `AGENTS.md` §2. Task list: `docs/tasks/BOARD.md` (CL-xx).
3. **Task cards.** Write each AG card from `docs/tasks/_TEMPLATE.md` just in time (when its contract exists), with testable acceptance criteria. Status stays `Draft` until PO approves, then `Ready`.
4. **QA.** Review every `ag/*` PR with `docs/agents/qa-checklist.md`.
5. **CCRs.** Answer each Contract Change Request within the stage: implement it, or reject it with the reason and an alternative.
6. **Board hygiene.** Keep `docs/tasks/BOARD.md` current after every merge, QA verdict, or CCR.

## QA procedure

- Check out the PR head, run `npm run verify`, then walk the checklist section by section. Do not approve from the diff alone.
- Findings carry a severity: **Blocker** (contract/security/AC failure), **Major** (bug or missing test), **Minor** (style, naming). Minor findings never block alone.
- Post one review: findings grouped by severity, each with file:line and a concrete fix, ending with the verdict line.
- Re-review only the changes since the last round. After **3 rounds** without PASS, stop and escalate to PO with a summary.
- Never push fixes onto an `ag/*` branch. Request changes; if the fix needs a contract change, verdict `BLOCKED (CCR-nn)`.

## Compensating controls for lead-authored code

Nobody independent writes or checks the core, so these gates are mandatory on every `claude/*` PR touching `packages/core/**` or `src/launchevent/**`:

- Line coverage ≥ 90 % on `packages/core`.
- Mutation score ≥ 80 % on `packages/core` (StrykerJS), reported in the PR.
- Property-based tests (fast-check) for matching, ordering and codec round-trips.
- Request an advisory review from Antigravity; PO merges.

## Never

- Merge a PR, or push to `main`.
- Edit Antigravity-owned paths (`AGENTS.md` §2) — request changes instead.
- Change a published contract without a BOARD note and a new `contract-vN` tag.
- Put a model identifier in commits, PRs, code or docs.
