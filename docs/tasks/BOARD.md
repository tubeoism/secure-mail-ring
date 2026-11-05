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
| CL-05 | S1 | Core decision engine: `policy` (floor, Strict preset), `evaluate`, fingerprint + acknowledgement key, `diff`, ring suggestion (E-3), ring expiry (E-8) | CL-02, CL-03, CL-04 | 1–2 | Done |
| CL-05B | S1 | Core: `codec` (share code, `fflate` + WebCrypto), `license`, `importVerify`, heartbeat payload builder | CL-02 | 1–2 | Done |
| CL-05C | S1 | Follow-up to CL-05 from the advisory review: `ak2` key includes `messageKey`, distinct fingerprint token shapes, no-ring sub-domain test | CL-05, CL-05B | 0.25 | Done |
| CL-04C | S1 | Fix to CL-04 test setup: Vitest `testTimeout` 30 s so the Stryker dry run no longer aborts on the Bloom tests | CL-04 | 0.25 | Done |
| CL-04D | S1 | Process fix: board change log becomes one file per PR (`docs/tasks/changelog/`), so parallel PRs stop conflicting on `BOARD.md` | — | 0.25 | In QA |
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
| AG-01 | S0–S1 | Clickable task-pane prototype on mocks for PO UX review | CL-00, CL-02 | 2–3 | Done (PO merged PR #29; QA round 1 findings in AG-01B) |
| AG-01B | S1 | Fix the QA findings of AG-01: Settings clipped at 320 px, hard-coded strings, behavioural tests | AG-01 | 0.5–1 | Ready |
| AG-02 | S2 | Ring list: list, search, duplicate, delete with confirm, archived rings | AG-01, CL-06 | 1–2 | Draft |
| AG-03 | S2 | Ring editor: members, subject tag, attachment tokens, per-finding policy, Strict preset, expiry | AG-02, CL-05 | 2–3 | Draft |
| AG-04 | S2 | Ordering editor: 3-column drag-and-drop (To/CC/BCC), shadowed-pattern warnings from core | AG-03, CL-03 | 1–2 | Draft |
| AG-05 | S2 | Field-rules editor (F8) with conflict display from core | AG-03, CL-04 | 1 | Draft |
| AG-06 | S2 | Settings: global floor, lookalike exceptions, F7 learning mode + paste known addresses, storage meter, language, About (bundle + manifest version) | AG-01, CL-06 | 1–2 | Draft |
| AG-07 | S2 | i18n catalog `vi` + `en` for every key in `contract-v1` | CL-02 | 1 | Ready (after AG-01 in Antigravity's queue) |
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

The history up to 2026-11-05 is in [`CHANGELOG.md`](CHANGELOG.md) (closed). New entries are one file per PR in [`changelog/`](changelog/README.md).
