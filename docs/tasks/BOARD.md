# Task Board

Owner legend: **CL** = Claude Code (lead/core/QA) · **AG** = Antigravity (features). Status flow: `Draft → Ready → In progress → In QA → Changes requested → Approved → Done`. Full cards live next to this file (`<ID>.md`); the lead writes each card just in time, once its contract exists.

Estimates are person-days for the owning agent and are indicative (plan §7).

## Lead track — Claude Code

| ID | Stage | Task | Depends on | Est. | Status |
|---|---|---|---|---|---|
| CL-00 | S0 | Repo scaffold (`yo office`, TS strict, ESLint, Vitest, workspaces), `npm run verify`, CI with path guard + i18n key check | — | 2–3 | Done |
| CL-01 | S0 | Technical spikes 1–7 (PO executes Outlook steps on Windows, incl. 5-day sideload stability log) | CL-00 | 3–4 | In progress |
| CL-02 | S1 | **Contract v1**: types, `OfficeAdapter`, `StorageAdapter`, `MockOfficeAdapter`, fixtures, i18n key list → tag `contract-v1` | CL-00 | 2–3 | Done |
| CL-03 | S1 | Core: `normalize`, `match`, `order`, `attachments` | CL-02 | 2–3 | Done |
| CL-04 | S1 | Core: `lookalike`, `history` (Bloom), `fieldRules` | CL-02 | 2–3 | Done |
| CL-04B | S1 | Fix F-1 of the advisory review: registrable-domain heuristic for `.id.vn`, `.io.vn`, `.biz.vn` and similar national sub-domains | CL-04 | 0.5 | Done |
| CL-05 | S1 | Core decision engine: `policy` (floor, Strict preset), `evaluate`, fingerprint + acknowledgement key, `diff`, ring suggestion (E-3), ring expiry (E-8) | CL-02, CL-03, CL-04 | 1–2 | In QA |
| CL-05B | S1 | Core: `codec` (share code, `fflate` + WebCrypto), `license`, `importVerify`, heartbeat payload builder | CL-02 | 1–2 | Ready (starts after CL-05, PR #19, merges) |
| CL-04C | S1 | Fix to CL-04 test setup: Vitest `testTimeout` 30 s so the Stryker dry run no longer aborts on the Bloom tests | CL-04 | 0.25 | In QA |
| CL-06 | S2 | Manifest v1 (all events, compose + read-mode buttons, `?mv=`), real `OfficeAdapter`, `StorageAdapter` on `roamingSettings` | CL-01, CL-02 | 2–3 | Draft |
| CL-07 | S3 | Compose events: `OnNewMessageCompose`, recipients/attachments changed, ring binding (`sessionData` + custom property) | CL-06 | 2–3 | Draft |
| CL-08 | S4 | `OnMessageSend` handler: evaluation, Warn/Acknowledge/Block, ack verification, reorder with invariant, Bloom write | CL-03, CL-04, CL-05, CL-05B, CL-07 | 4–6 | Draft |
| CL-09 | S6 | Domain lock (hashed), obfuscation profile, post-build check, hosting + deploy pipeline | CL-08 | 3–4 | Draft |
| CL-10 | S7–S8 | Release, integration test plan + evidence review, pilot metrics, control description (EN) | CL-09 | 2–3 | Draft |
| CL-11 | S0 (tooling) | Antigravity bridge: project-scoped MCP, allow/deny hook, routing table in `CLAUDE.md`, T1–T6 validation. Off the critical path; not in the lead total | CL-00 | 1–2 | Done |
| CL-12 | S0 (tooling) | Antigravity async job runner: background `agy-job` with stream-json liveness, idle/hard kill with partial output, guard on the shell route. Read-only; write mode waits for test T7. Off the critical path | CL-11 | 1 | Done |
| CL-13 | S0 (tooling) | Agent toolkit: one versioned source for the `agy-bridge` plugin and the shared workflow content, a sync tool for vendoring into other repositories. Off the critical path | CL-11, CL-12 | 2–3 | In progress |
| CL-QA | all | QA of every AG PR (`docs/agents/qa-checklist.md`), CCR handling | — | 3–5 | Ongoing |
| | | **Lead total** | | **29–43** | |

## Feature track — Antigravity

| ID | Stage | Task | Depends on | Est. | Status |
|---|---|---|---|---|---|
| AG-01 | S0–S1 | Clickable task-pane prototype on mocks for PO UX review | CL-00, CL-02 | 2–3 | Ready (dependencies Done; starts when PO releases it) |
| AG-02 | S2 | Ring list: list, search, duplicate, delete with confirm, archived rings | AG-01, CL-06 | 1–2 | Draft |
| AG-03 | S2 | Ring editor: members, subject tag, attachment tokens, per-finding policy, Strict preset, expiry | AG-02, CL-05 | 2–3 | Draft |
| AG-04 | S2 | Ordering editor: 3-column drag-and-drop (To/CC/BCC), shadowed-pattern warnings from core | AG-03, CL-03 | 1–2 | Draft |
| AG-05 | S2 | Field-rules editor (F8) with conflict display from core | AG-03, CL-04 | 1 | Draft |
| AG-06 | S2 | Settings: global floor, lookalike exceptions, F7 learning mode + paste known addresses, storage meter, language, About (bundle + manifest version) | AG-01, CL-06 | 1–2 | Draft |
| AG-07 | S2 | i18n catalog `vi` + `en` for every key in `contract-v1` | CL-02 | 1 | Draft (approved by PO; Ready when PR #20 merges) |
| AG-08 | S3 | Compose pane: ring picker, suggested ring, "Sort now" button | AG-03, CL-07 | 1–2 | Draft |
| AG-09 | S4 | Acknowledge pane: findings with per-item tick, confirm flow | AG-08, CL-08 | 1–2 | Draft |
| AG-10 | S5 | Export / share: code block, copy, "Share with colleagues", share-email template | AG-03, CL-05B | 1–2 | Draft |
| AG-11 | S5 | Import: paste screen, diff preview with risk highlights, read-mode "Import from this email" with verification result | AG-10, CL-05, CL-05B, CL-06 | 2–3 | Draft |
| AG-12 | S6 | Heartbeat worker (Cloudflare Worker) — D-17 approved | CL-05B | 1–2 | Draft |
| AG-13 | S7 | User docs (VI): install guide, user guide, FAQ, Wef-cache troubleshooting, 2-minute video script | AG-11 | 1–2 | Draft |
| AG-14 | S8 | Rollout kit: announcement emails, key-user handbook, pilot feedback form | AG-13 | 1 | Draft |
| | | **Feature total** | | **17–28** | |

## Critical path

`CL-00 → CL-02 → (CL-03..05 ∥ AG-01, AG-07) → CL-06 → (CL-07 ∥ AG-02..06) → CL-08 → (AG-09 ∥ AG-10, AG-11) → CL-09 → CL-10 ∥ AG-13 → AG-14`

## Contract Change Requests

| ID | From card | Summary | Status |
|---|---|---|---|
| — | — | — | — |

## Change log

| Date | Change |
|---|---|
| 2026-10-29 | Board created; AG-01 card written (Draft, awaiting PO approval) |
| 2026-10-29 | Plan v1.0 approved (G0). AG-01 → Ready. D-17 approved → AG-12 in scope. E-3, E-8 added to CL-05 |
| 2026-10-29 | CL-00 PR opened (Web Add-in platform confirmed by PO; scaffold hand-written, no `yo office`) → In QA |
| 2026-10-29 | CL-00 merged (PR #2) → Done. CL-01 card written (Draft, awaiting PO approval; Q1–Q3 answered) |
| 2026-10-29 | PO approved CL-01 → Ready (starts after PR #3 merges) |
| 2026-10-29 | CL-01 harness and runbook delivered (PR open) → In progress; waiting on PO execution of spikes |
| 2026-10-29 | CL-02 card written (Draft, awaiting PO decisions Q1–Q3 and approval) |
| 2026-10-29 | CL-02 contract code delivered (PR open) → In QA; tag `contract-v1` after PO merge and sign-off |
| 2026-10-29 | CL-02 merged (PR #6) → Done. Contract v1 published at merge commit dda04bb; tag `contract-v1` pending (the session cannot push tags; PO or a permitted session creates it). AG-01 dependencies are Done |
| 2026-10-29 | CL-03 card written (Draft, awaiting PO decisions Q1–Q3 and approval) |
| 2026-10-29 | PO approved CL-03 (Q1–Q3 yes) → Ready → In progress |
| 2026-10-29 | CL-03 code delivered (PR open) → In QA |
| 2026-10-29 | Board correction: CL-04, CL-05 and AG-07 had been set to In QA/Done by a batch edit made with the CL-02 commits; nothing was delivered for them. Reset to Draft. CL-03 moved from the stale Done to In QA |
| 2026-10-29 | CL-03 merged (PR #9) → Done. Real `sortRecipients` and `findShadowedPatterns` are live in the contracts `core`; Antigravity advisory review of PR #9 not yet recorded |
| 2026-10-29 | CL-04 card written (Draft, awaiting PO decisions Q1–Q3 and approval) |
| 2026-10-29 | PO approved CL-04 (Q1–Q3 yes) → Ready → In progress |
| 2026-10-29 | CL-04 code delivered (PR open) → In QA |
| 2026-10-30 | CL-04 merged (PR #10) → Done. Real `detectFieldRuleConflicts` is live in the contracts `core`; lookalike, history and field-rule evaluators are exported from `@smr/core` for CL-05 and CL-08. Antigravity advisory review of PRs #9 and #10 not yet recorded |
| 2026-10-30 | CL-05 card drafted (Draft, awaiting PO answers to Q1–Q4). Old CL-05 split: decision engine stays CL-05, codec/license/importVerify/heartbeat payload become CL-05B; dependencies of CL-08, AG-10, AG-11, AG-12 updated. Open item G-1: `RingDiff` of contract-v1 omits `internalDomain`, `firstTimeCheck`, field rules and tokens; decide before AG-11 (see CL-05 Q4). Note for AG-07: `finding.lookalike` must read well when `ring` is empty (sender's own domain) |
| 2026-11-05 | CL-11 card written (Draft, awaiting PO approval). PO decisions D-1 to D-6 recorded in the card, incl. read-only advisory review of core PRs through the bridge |
| 2026-11-05 | PO approved CL-11 (thread message "Duyệt") → Ready → In progress. T1–T6 run on the PO machine; nothing installed before this approval |
| 2026-11-05 | CL-11 delivered (PR #12) → In QA. T1, T2, T4, T6 pass; T3 needs PO to approve the MCP server; T5 found agy reads named paths outside add_dir (AC-5 open, PO decision). Bridge calls are read-only |
| 2026-11-05 | CL-11 merged (PR #12) → Done. T3 passed in a fresh session (AC-3 ticked, `delegation-log.md` row added). PO approved the next dev step: advisory `[REVIEW]` of merged PRs #9 (CL-03) and #10 (CL-04) through the bridge, one at a time |
| 2026-11-05 | Antigravity advisory review of PRs #9 and #10 recorded (partial coverage; broad prompts time out, so it ran as narrow questions): no blockers. One Major in CL-04 code (F-1: `splitRegistrable` mishandles `.id.vn`, `.io.vn`, `.biz.vn`, `.info.vn`, so look-alikes under them are missed) and five Minor/Info items. Details and proposed follow-up in `docs/agents/advisory-review-pr9-pr10.md`; follow-up awaits PO approval |
| 2026-11-05 | CL-12 card written and set In progress on the PO message "Ok, làm như đề xuất" (async runner first, then test T7). Delivered the same day → In QA: `scripts/agy-job.mjs`, shell-route guard, `CLAUDE.md` async section. Read-only; no skip-permissions. T7 confinement test not started |
| 2026-11-05 | CL-12 test T7 done (40 agy runs in a temp lab): agy file tools read and write anywhere on disk in headless default mode; `--sandbox` and `--settings` allow-rules do not change that; only `--mode plan` blocks writes. Correction recorded in CL-11 Notes (D-3 "read-only" was wrong for the MCP tools). Runner now always uses plan mode; `CLAUDE.md` warns against `agy_ask` and `agy_research` until PO decides. No write mode is supported by the evidence |
| 2026-11-05 | PO chose the more automated option for the MCP tools: community MCP bridge retired (CL-12 D-10). `.mcp.json` empty, hook refuses `mcp__antigravity__*`, subagents and `AGENTS.md` §9 now describe the runner. CL-11 note updated |
| 2026-11-05 | CL-04B written and implemented on the PO message "Ok" (F-1 fix only; F-4 and F-6 stay unapproved). `splitRegistrable` now knows per-country second levels. 416 tests, 100 % line coverage, mutation score of `lookalike.ts` 92.62 % → In QA |
| 2026-11-05 | CL-13 card written (Draft, awaiting PO answers Q1–Q4 and approval) after the PO chose option 1: Antigravity writes code in its own session, Claude writes cards and does QA, shared tooling for future repositories |
| 2026-11-05 | PO answered Q1–Q4 of CL-13 (name `antigravity-agent-toolkit`, private; policy JSON per repository; shared content as proposed; separate repository, create it) → In progress. Work happens in the new repository; migration of this repository is a later PR |
| 2026-11-05 | CL-13: repository `antigravity-agent-toolkit` created; first PR merged by the PO; tag `v0.1.0` and branch `stable` created on the PO "go". AC-1, AC-2, AC-4, AC-5 done (marketplace install tested and removed again); AC-3 tests pass. Open: AC-6, AC-7 and the migration PR (AC-8), which needs #14 merged first |
| 2026-11-05 | PRs #13 (CL-11 close-out) and #14 (CL-12) merged by the PO → CL-12 Done. Conflicts of the CL-04B and CL-13 PRs with the new `main` resolved by merging `main` into their branches (BOARD only) |
| 2026-11-05 | CL-13 migration: this repository now uses the agent toolkit (`v0.2.0`): scripts and generic agents removed, `.claude/agy-policy.json` added, plugin and marketplace declared in settings, workflow content synced, fail-closed tripwire registered. Finding: repository settings alone do not load the plugin in a headless run, so the tripwire (toolkit PR #2) keeps the rule where the plugin is absent; each machine installs the plugin once. AC-3, AC-8, AC-9 done; AC-6 and AC-7 open |
| 2026-11-05 | Execution plan for the rest of v1.0 written (`docs/tasks/EXECUTION-PLAN.md`): waves, routing, what is blocked on the PO. Tag `contract-v1` pushed to the remote (it existed only locally). AG-07 card written (Draft). PR #17 merged by the PO |
| 2026-11-05 | PO answered CL-05 Q1–Q4 as recommended (split accepted; mail without a ring and expired rings; acknowledgements per finding; `RingDiff` deferred to `contract-v2`); CL-05 is implemented in its own thread. CL-05B card written (Draft): codec, licence, import-source check, heartbeat payload, additive `contract-v2` |
| 2026-11-05 | PO approved AG-07 and the four answers of CL-05B ("Ok, go"). CL-05B → Ready, starts after CL-05 (PR #19) merges. AG-07 → Ready when PR #20 merges: it adds the placeholder check of `vi`/`en` to `scripts/i18n-check.mjs` and fixes that check, which did nothing on Windows |
| 2026-11-05 | PO answered "Ok" to CL-05 Q1–Q4 (card approved, Ready → In progress). Delivered the same day → In QA: policy, evaluate, fingerprint + acknowledgement key, diff, ring suggestion, ring expiry; `createCore` now replaces every function except the codec. 485 tests, 100 % line coverage, mutation 94.31 %. Published fixtures left unchanged; three simplifications pinned in `evaluate.contract.test.ts` (CL-05 Notes). Advisory review by Antigravity still to be run from a session on the PO's machine |
| 2026-11-05 | CL-04C written and implemented on the PO message "OK": the `mutation` job was red on `main` since CL-04 because the Stryker dry run timed out (5 s default) on the Bloom tests; `testTimeout` raised to 30 s → In QA |
