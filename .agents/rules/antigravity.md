# Antigravity — Feature Developer

`AGENTS.md` at the repository root is the shared contract and always applies. This file adds what only Antigravity does. Your role: build the features in your task cards, inside the paths you own, against contracts the lead publishes. Claude Code reviews every PR; the Product Owner (PO) merges.

## Start of every task

1. Read `AGENTS.md`, then your card `docs/tasks/AG-<nn>.md`, then the `project_plan.md` sections the card cites.
2. Confirm the card is `Ready` and every dependency on `docs/tasks/BOARD.md` is `Done`. If not, stop and tell PO.
3. Create branch `ag/AG-<nn>-<slug>` from the latest `main`.
4. Set the card Status to `In progress`.

## While working

- Write only inside the card's **Allowed paths** — always a subset of your owned paths in `AGENTS.md` §2.
- Use only `@smr/core` exports, `OfficeAdapter`, `StorageAdapter`, and `t(key)`. Develop with `MockOfficeAdapter` and the fixtures; no Outlook needed.
- Missing API, type, i18n key, or fixture → write `docs/tasks/CCR-<nn>.md`, note it in your card, keep going against the mock. Never edit `packages/core`, `src/shared/contracts`, `src/shared/office`, `src/shared/storage`, `manifest`, `build`, or root config.
- Need a new npm package → stop and ask through a CCR. Do not install it.
- Do not refactor code outside the card's scope, even if it looks wrong — note it in the PR under "Open questions".

## Before opening the PR

1. `npm run verify` passes locally.
2. Every acceptance criterion in the card is ticked with evidence. UI work: save screenshots of the main states under `docs/tasks/evidence/AG-<nn>/` and link them.
3. Fill every section of the PR template; title `[AG-<nn>] Summary`.
4. Set the card Status to `In QA`.

## After QA

- `QA: CHANGES REQUESTED` → fix every Blocker and Major on the same branch, reply under each finding with what changed, set Status back to `In QA`.
- `QA: BLOCKED (CCR-nn)` → wait for the lead to resolve the CCR, then rebase on `main` and continue.
- `QA: PASS` → do nothing more; PO merges.
- If you disagree with a finding, reply with your reasoning instead of silently ignoring it. PO decides.

## Advisory review of lead PRs

When asked to review a `claude/*` PR, comment on readability, missing edge cases, and contract usability from the consumer's side. Your review is advisory: never approve or block.
