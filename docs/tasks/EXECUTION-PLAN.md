# Execution plan: Secure Mail Ring v1.0

Written 2026-11-05 on the PO's request ("Lập kế hoạch thực hiện dự án và tiến hành"). It orders the work that `BOARD.md` already lists; it creates no new scope. Estimates are the BOARD's, in days of agent work. A step starts only when its card is `Ready` (PO approval), every dependency is `Done`, and the PO has not said otherwise.

## 1. Where the project stands

| Area | Done | In progress | Not started |
|---|---|---|---|
| Lead track | CL-00 scaffold, CL-02 contract v1 (tag `contract-v1` pushed on 2026-11-05), CL-03, CL-04, CL-04B | CL-01 spikes (harness and runbook delivered, waiting for the PO to run them on Windows with Outlook), CL-13 toolkit (PR #17 merged; AC-6 and AC-7 open) | CL-05, CL-05B, CL-06 to CL-10 |
| Feature track | none merged | AG-01 has a branch `ag/AG-01-prototype` with one commit and an unpushed stash on the PO's machine; its board status is still `Ready` | AG-02 to AG-14 |
| Tooling (off the critical path) | CL-11 bridge, CL-12 job runner, toolkit v0.2.0, this repository migrated to the toolkit (PR #17) | CL-13 AC-6 (update path) and AC-7 (cloud check) | none |

Critical path (from the board): `CL-00 → CL-02 → (CL-03..05 ∥ AG-01, AG-07) → CL-06 → (CL-07 ∥ AG-02..06) → CL-08 → (AG-09 ∥ AG-10, AG-11) → CL-09 → CL-10 ∥ AG-13 → AG-14`. Two things hold it up today and both belong to the PO: the CL-01 spikes (the Spike 7 stability log needs five working days) and the CL-05 questions.

## 2. Sequence

| Wave | Stage | Claude (lead) | Antigravity (own session, `ag/*` branch, one card at a time) | PO | Gate to leave the wave |
|---|---|---|---|---|---|
| 0, now | S0 | Cards in Draft: AG-07 (written), CL-05B; finish CL-13 AC-6 and AC-7 | AG-01: review what exists | Install the plugin on each machine; run CL-01 step 0 to Spike 7; answer CL-05 Q1 to Q4 | Spikes started, Q1 to Q4 answered |
| 1 | S1 | CL-05 decision engine (1 to 2), then CL-05B codec, license, importVerify, heartbeat payload (1 to 2) | AG-01 (2 to 3), then AG-07 i18n catalogs (1) | Approve each card; UX review of AG-01 | `@smr/core` complete for CL-08; AG-01 and AG-07 merged |
| 2 | S2 | CL-06 manifest v1, real adapters (2 to 3) | AG-02 ring list, AG-06 settings, AG-03 ring editor, AG-04 ordering editor, AG-05 field-rules editor (7 to 11 in total) | CL-01 Go/No-go for plan A; install check of the first sideload build | Task pane complete on real adapters |
| 3 | S3 to S5 | CL-07 compose events (2 to 3), CL-08 `OnMessageSend` handler (4 to 6) | AG-08 compose pane, AG-10 export and share, AG-11 import, AG-09 acknowledge pane, AG-12 heartbeat worker | Manual test matrix of plan 8.2 with evidence; Cloudflare account for AG-12 | Send-time path works end to end in Outlook |
| 4 | S6 to S8 | CL-09 domain lock, obfuscation, hosting (3 to 4), CL-10 release, integration plan, pilot metrics (2 to 3) | AG-13 user docs (VI), AG-14 rollout kit | Pilot with about 100 users, sign-off | Pilot metrics reviewed |

Running in every wave: CL-QA (Claude reviews each `ag/*` PR with `docs/agents/qa-checklist.md`; one review, one verdict line, three rounds at most) and the compensating controls on every core PR (coverage at least 90 %, mutation score at least 80 %, property tests for matching, ordering and codecs, an advisory review through the job runner, PO merges).

Order inside Antigravity's queue (it works one card at a time): AG-01, AG-07, AG-02, AG-06, AG-03, AG-04, AG-05, AG-08, AG-10, AG-11, AG-09, AG-12, AG-13, AG-14. AG-07 only needs `contract-v1`, so it can run right after AG-01 without waiting for the spikes.

## 3. Dependencies that decide the order

| Item | Waits for | Why it matters |
|---|---|---|
| CL-06 manifest | CL-01 complete (all spikes, including the Spike 7 log) | Any manifest change forces every user to reinstall (`AGENTS.md` section 8); batch it once the facts are known. A No-go on plan A switches the project to the COM add-in on .NET Framework 4.8.1 (plan B), which changes CL-06 to CL-10 |
| CL-08 handler | CL-05, CL-05B, CL-07 | Largest lead card (4 to 6); starts the moment its inputs are merged |
| AG-03 ring editor | AG-02 and CL-05 | CL-05 defines the policy shapes the editor edits |
| AG-05 field-rules editor | AG-03 | Needs a way to show invalid rule patterns; finding F-4 of the advisory review (core helper) is not approved yet, so AG-05 either gets that helper or shows no warning |
| AG-11 import | AG-10, CL-05, CL-05B, CL-06 | Needs the `RingDiff` decision (CL-05 Q4) before it starts |
| AG-12 heartbeat worker | CL-05B | Needs the payload schema and a Cloudflare account |

## 4. What is blocked on the PO

| # | Item | What is needed | Recommendation | Unlocks |
|---|---|---|---|---|
| 1 | Plugin (CL-13) | PR #17 is merged. Install the plugin once per machine: `/plugin install agy-bridge --marketplace tubeoism/antigravity-agent-toolkit`. Without it jobs cannot run on that machine; direct `agy` calls stay refused by the tripwire | Install on the main Windows machine | Advisory reviews and briefs through jobs; CL-13 AC-6 and AC-7 |
| 2 | CL-01 spikes | Run step 0 to Spike 7 on the Windows tenant, fill `docs/spikes/RESULTS.md`. Spike 7 may start before the others finish; the five working days start when the harness is up | Start Spike 7 first, as agreed on 2026-10-29 | CL-06 and the Go/No-go for plan A |
| 3 | CL-05 Q1 | Split the old CL-05 into CL-05 and CL-05B | Yes | CL-05, CL-05B |
| 4 | CL-05 Q2 | Mail without a ring and expired rings: external recipients, look-alikes and external first-time recipients only; an expired ring counts as no ring; suggest a ring only when one is the unique best match | Yes | CL-05 |
| 5 | CL-05 Q3 | Acknowledgements are per finding and bound to a fingerprint of recipients, fields and file names; Warn can never be acknowledged away | Yes | CL-05, AG-07 finding texts, AG-09 |
| 6 | CL-05 Q4 | `RingDiff` omits `internalDomain`, `firstTimeCheck`, field rules and tokens: add it as an additive `contract-v2` before AG-11, or amend `contract-v1` now | Defer to `contract-v2` (only AG-11 uses it) | AG-01 not delayed |
| 7 | AG-01 | The branch has a commit and a stash. Decide: continue it in Antigravity's session, then open the PR for QA, or start over from the card | Continue; the stash holds work in progress | Wave 1 for the feature track |
| 8 | Cards | Approve AG-07 (written, Draft), CL-05 (after Q1 to Q4), CL-05B (to be written) | Approve | Wave 1 |
| 9 | Optional hardening | Finding F-4 (helper that lists invalid field-rule patterns) and F-6 (local part cap, rejecting `<` and `>`) from the advisory review | Do F-4 inside CL-05 or AG-05's prerequisite; F-6 later | AG-05 quality |
| 10 | Later, not yet asked | Cloudflare account (AG-12), hosting and domain for CL-09, build-time secrets for the license (CL-05B) | Ask when the card is written | Waves 3 and 4 |

## 5. Risks and how the plan handles them

| Risk | Handling |
|---|---|
| Spike 7 shows the add-in is unstable (events stop firing, Wef cache) | Plan B (COM add-in on .NET Framework 4.8.1) is the pre-approved fallback; waves 2 to 4 would be re-planned. Do not start CL-06 before the result |
| The PO's time is the bottleneck: spikes, card approvals, merges, the manual test matrix | Cards are written in advance and in batches; each wave lists exactly what the PO must do; PR conflicts on `BOARD.md` are resolved by Claude |
| Antigravity PRs fail QA repeatedly | Three-round limit, then escalate; a missing contract piece goes through a CCR, never a workaround |
| Core regressions (the core is written and checked by one author) | The compensating controls above, plus the advisory review through the job runner in plan mode |
| Antigravity quota runs out | D-4: defer code-adjacent jobs until the reset; reviews can wait |
| A new machine or cloud session has no plugin | The tripwire hook keeps the rule (no direct `agy` call) fail-closed; jobs need the plugin installed once |

## 6. First steps proposed (nothing below starts without the PO)

1. The PO installs the plugin and starts the CL-01 runbook (items 1 and 2). Nothing else waits on item 1; item 2 starts the five-day clock.
2. The PO answers CL-05 Q1 to Q4 and approves the AG-07 card. Claude then sets AG-07 to `Ready` and starts CL-05.
3. Claude writes the CL-05B card (Draft) as soon as the PO answers Q1 and Q4, because its scope depends on them.
4. The PO decides what to do with AG-01 (item 7).
