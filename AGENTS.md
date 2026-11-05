# Secure Mail Ring — Agent Contract

Shared rules for every AI agent working in this repository. Role-specific rules live in `CLAUDE.md` (Claude Code — lead, core developer, QA) and `.agents/rules/antigravity.md` (Antigravity — feature developer). Scope and requirements: `project_plan.md`. If this file and the plan disagree, stop and ask the Product Owner (PO).

## 1. Roles

| Role | Who | Does | Never |
|---|---|---|---|
| Approver | PO (human) | Approves plans and task cards, merges every PR, runs the manual Outlook test matrix | — |
| Lead / Core / QA | Claude Code | Contracts, core rule engine, send-time control path, manifest, security, build/CI, QA of every Antigravity PR, task cards | Merge any PR; edit Antigravity-owned paths |
| Feature developer | Antigravity | UI, i18n texts, user docs, rollout kit, heartbeat worker — strictly per task card | Edit lead-owned paths; add dependencies; call `Office.*` directly |

Maker → checker → approver: Antigravity makes, Claude checks, PO approves. Claude's own PRs are checked by automated gates (coverage, mutation testing) plus an advisory review by Antigravity, then approved by PO.

## 2. Ownership map

**Lead-owned** (Antigravity: read-only)
- `packages/core/**`
- `src/launchevent/**`
- `src/shared/contracts/**`, `src/shared/office/**`, `src/shared/storage/**`
- `manifest/**`, `build/**`, `.github/**`
- Root config: `package.json`, lockfile, `tsconfig*`, `webpack*`, `eslint*`, `vitest*`
- `AGENTS.md`, `CLAUDE.md`, `.agents/**`, `docs/agents/**`, `project_plan.md`
- `.mcp.json`, `.claude/**`, `scripts/**` (agent bridge configuration, hook and repo guards; CL-11)

**Antigravity-owned**
- `src/taskpane/**`, `src/readmode/ui/**`
- `src/shared/i18n/locales/**` — translation values only; keys are defined in contracts
- `worker/heartbeat/**` — only if decision D-17 is approved
- `docs/user/**`, `docs/rollout/**`

**Shared:** `docs/tasks/**` — each agent edits only the Status/Notes of its own cards. New cards are written by the lead.

CI path guard: a PR from an `ag/*` branch that touches a lead-owned path fails.

## 3. Contracts

- Antigravity code reaches the add-in only through: public exports of `@smr/core`, the `OfficeAdapter` and `StorageAdapter` interfaces, and `t(key)` for text. Never `Office.*`, never `window.localStorage`.
- Contracts are versioned by git tag `contract-vN`. Only the lead changes them, with a BOARD note.
- Something missing from a contract → write a Contract Change Request `docs/tasks/CCR-<nn>.md` from `docs/tasks/_CCR_TEMPLATE.md`, keep working against the mock, never work around the contract.
- Work without Outlook: `MockOfficeAdapter` + fixtures in `src/shared/contracts/fixtures/` run the task pane in a plain browser.

## 4. Tasks

- Board: `docs/tasks/BOARD.md`. Cards: `docs/tasks/<ID>.md`, created from `docs/tasks/_TEMPLATE.md`.
- One PR = one card. Start a card only when its Status is **Ready** and every dependency is **Done**.
- Status flow: `Draft → Ready → In progress → In QA → Changes requested → Approved → Done`.
- Ready is set by the lead after PO approval of the card. Done is set when PO merges.
- Change log: one new file per event in `docs/tasks/changelog/` (rules in its `README.md`). A PR edits only the Status cell of its own card in `BOARD.md`, never a shared table, so open PRs do not conflict on the board.

## 5. Git conventions

- Branches: `claude/<CL-ID>-<slug>`, `ag/<AG-ID>-<slug>`. Base: `main`. Never push to `main`. Never force-push a branch you do not own.
- Commit subject: `[<ID>] Imperative summary`.
- PR title: `[<ID>] Summary`; fill every section of `.github/pull_request_template.md`.
- Keep a PR under ~400 changed lines excluding locales and fixtures; split otherwise.

## 6. Definition of Done (every PR)

1. `npm run verify` passes: lint, typecheck, unit/component tests, path guard, i18n key completeness.
2. Each acceptance criterion of the card is checked with evidence (test name, screenshot path, or command output).
3. No new dependency unless the card says so explicitly.
4. No `console.log`, `eval`, `innerHTML`, `dangerouslySetInnerHTML`; no network call unless the card allows it.
5. Every user-visible string goes through an i18n key, with both `vi` and `en` values.
6. New logic has tests; each UI component has Testing Library tests for its empty, loaded and error states.
7. QA verdict **PASS** from the lead; PO merges.

## 7. Coding standards

- TypeScript `strict`; no `any` (use `unknown` and narrow).
- React 18 function components and Fluent UI React v9 only — no other UI library.
- Accessibility: every interactive element is keyboard-reachable and labelled.
- Everything read from mail items, pasted codes or imports is **untrusted**: render as text, validate through `@smr/core`.
- Never log or persist email addresses, subjects or file names except through `StorageAdapter`.
- User-facing errors through i18n; never swallow an error silently.

## 8. Security invariants (non-negotiable)

- Send-time code must never block sending because of its own errors (fail-open; manifest `SoftBlock`).
- Recipient reordering preserves the exact multiset of recipients (plan FR-3.6).
- No allowed domain, secret, or source map in the repository or the production bundle.
- Configuration sharing to recipients outside the internal domain is blocked.
- Any manifest change forces every user to reinstall — manifest changes are lead-only and batched.

## 9. Handoff

There is no direct channel between agents. Communicate only through task cards, PR descriptions and QA comments. Every PR description states what changed, how it was verified, and open questions. Every QA comment ends with one verdict line: `QA: PASS`, `QA: CHANGES REQUESTED`, or `QA: BLOCKED (<reason>)`.

The Antigravity job runner (plugin `agy-bridge` of the agent toolkit, `tubeoism/antigravity-agent-toolkit`; CL-11, CL-12, CL-13) is a transport only. A Claude session on the PO's machine may send Antigravity a bounded read-only brief (research, long-context analysis, design second opinion, advisory PR review) and read the reply. The card, PR description and QA verdict stay the record; every job is logged in `docs/agents/delegation-log.md`. Jobs run in plan mode and never write to the repository; the community MCP bridge is retired because it cannot guarantee that (CL-12 test T7). What a job may see is set in `.claude/agy-policy.json`.

## 10. Environments

| Agent | Runs on | Can | Cannot |
|---|---|---|---|
| Claude Code | Cloud Linux container | Build, unit/component/mutation tests, review, CI | Run Outlook |
| Antigravity | PO's Windows machine | Dev server, browser preview with mocks, sideload for visual check | Push to lead-owned paths |
| PO | Windows + Outlook | Manual test matrix (plan §8.2) with evidence | — |

The Antigravity bridge runs only in Claude sessions on the PO's Windows machine. Cloud sessions and CI cannot use it.
