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
| CL-05 | S1 | Core: `policy`, `codec`, `license`, `importVerify`, `diff`, ring suggestion (E-3), ring expiry (E-8), heartbeat payload builder | CL-02 | 2–3 | Done |
| CL-06 | S2 | Manifest v1 (all events, compose + read-mode buttons, `?mv=`), real `OfficeAdapter`, `StorageAdapter` on `roamingSettings` | CL-01, CL-02 | 2–3 | Draft |
| CL-07 | S3 | Compose events: `OnNewMessageCompose`, recipients/attachments changed, ring binding (`sessionData` + custom property) | CL-06 | 2–3 | Draft |
| CL-08 | S4 | `OnMessageSend` handler: evaluation, Warn/Acknowledge/Block, ack verification, reorder with invariant, Bloom write | CL-03, CL-04, CL-05, CL-07 | 4–6 | Draft |
| CL-09 | S6 | Domain lock (hashed), obfuscation profile, post-build check, hosting + deploy pipeline | CL-08 | 3–4 | Draft |
| CL-10 | S7–S8 | Release, integration test plan + evidence review, pilot metrics, control description (EN) | CL-09 | 2–3 | Draft |
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
| AG-07 | S2 | i18n catalog `vi` + `en` for every key in `contract-v1` | CL-02 | 1 | Done |
| AG-08 | S3 | Compose pane: ring picker, suggested ring, "Sort now" button | AG-03, CL-07 | 1–2 | Draft |
| AG-09 | S4 | Acknowledge pane: findings with per-item tick, confirm flow | AG-08, CL-08 | 1–2 | Draft |
| AG-10 | S5 | Export / share: code block, copy, "Share with colleagues", share-email template | AG-03, CL-05 | 1–2 | Draft |
| AG-11 | S5 | Import: paste screen, diff preview with risk highlights, read-mode "Import from this email" with verification result | AG-10, CL-05, CL-06 | 2–3 | Draft |
| AG-12 | S6 | Heartbeat worker (Cloudflare Worker) — D-17 approved | CL-05 | 1–2 | Draft |
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
