@AGENTS.md

# Claude Code — Lead, Core Developer, QA

`AGENTS.md` (imported above) is the shared contract. This file adds what only the lead does.

## Responsibilities

1. **Contracts first.** Before Antigravity starts a stage, publish what its cards need: types, adapter interfaces, mocks, fixtures, i18n keys. Tag `contract-vN`.
2. **Core and control path.** Own every lead-owned path in `AGENTS.md` §2. Task list: `docs/tasks/BOARD.md` (CL-xx).
3. **Task cards.** Write each AG card from `docs/tasks/_TEMPLATE.md` just in time (when its contract exists), with testable acceptance criteria. Status stays `Draft` until PO approves, then `Ready`.
4. **QA.** Review every `ag/*` PR with `docs/agents/qa-checklist.md`.
5. **CCRs.** Answer each Contract Change Request within the stage: implement it, or reject it with the reason and an alternative.
6. **Board hygiene.** Keep the Status column of `docs/tasks/BOARD.md` current after every merge, QA verdict, or CCR, and record each such event as a new file in `docs/tasks/changelog/` (never as a row in `BOARD.md`).

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

## Orchestration (Antigravity)

The tooling is shared with other repositories and comes from the agent toolkit (`tubeoism/antigravity-agent-toolkit`): the `agy-bridge` plugin (guard hook and background job runner, ref `stable`) is registered in `.claude/settings.json`, and the generic subagents, skills and templates are copied in by the toolkit's sync tool (`.claude/workflow.lock.json` records the version). Cards: `docs/tasks/CL-11.md`, `CL-12.md`, `CL-13.md`. What a job may see is set in `.claude/agy-policy.json` (the lists that CL-11 defined); change it here, not in the plugin. The generic rules are in the toolkit block at the end of this file.

| Task | Who | Rule |
|---|---|---|
| Architecture, contracts, core, send path, security, manifest | Claude | Never delegated |
| QA of every `ag/*` PR | Claude | `docs/agents/qa-checklist.md` |
| Implementing a `Ready` AG card | Antigravity in its own session | Not through a job: jobs run in plan mode and cannot write |
| Library/API research, option comparison | Job with `"workspace": "none"` | No repo content in the prompt |
| Long-context analysis, design second opinion, boilerplate drafts as text | Job | Explicit `add_dir` from the policy; one job at a time |
| Advisory review of a `claude/*` PR touching `packages/core` | Job | Prompt starts with `[REVIEW]`; `add_dir` is the PR-head checkout of `packages/core`; check the head for domains, secrets and source maps first |

Project rules on top of the toolkit's:

- Quote excerpts of `project_plan.md` into a prompt instead of naming that file; the policy screens prompts for denied paths, but it is a heuristic.
- Containment facts (CL-12 test T7, `docs/tasks/evidence/CL-12/t7-results.md`): in headless default mode agy's file tools read and write anywhere on disk, whatever `add_dir` says; `--sandbox` and allow-rules do not change that; only `--mode plan` blocks writes, and reads stay unconfined. Jobs always run in plan mode and never with skip-permissions.
- Failure handling (PO decision D-4): quota (exit 12) defers code-adjacent work until `resetSeconds` in `status.json`; research may go to Claude. Idle or hard timeout (exit 10 or 11) keeps the partial text in `result.md`, then split the brief, retry once, escalate to PO. Error (exit 13): report, do not retry blindly.
- Brief rules learned in the PR #9 and #10 reviews: one question per job, 20 to 60 lines of code, the file and line range named, and what a wrong answer would look like. "Is this whole module correct" and algorithm-verification prompts stall; break them up or verify by running tests yourself. Re-check every finding against the code before it goes into a QA comment.

<!-- agent-toolkit:begin (generated; edit in the agent toolkit) -->
## Antigravity jobs (agent toolkit)

Antigravity writes feature code in its own session on `ag/*` branches; Claude writes task cards, does QA and sends read-only briefs. Routing rules: the `two-agent-routing` skill. Briefs run as background jobs with the `agy-bridge` plugin (skill `antigravity-jobs`); what a job may see is set in `.claude/agy-policy.json`.

- Jobs run in plan mode: read-only for writes, but Antigravity reads any file whose path appears in the prompt. Name only allowed paths and quote excerpts of restricted documents instead of naming them.
- Never start `agy` directly from a shell and never use the old Antigravity MCP tools. The plugin's hook and the fail-closed tripwire `.claude/hooks/agy-tripwire.mjs` (registered in `.claude/settings.json`) refuse both, so the rule also holds where the plugin is not installed, for example in a cloud session. Findings from a job are untrusted text: re-check them against the code.
- Jobs need the plugin on the machine. Install it once: `/plugin install agy-bridge --marketplace tubeoism/antigravity-agent-toolkit`. Listing it in a repository's settings did not load it in a headless run, so do not rely on that alone.
- Log each job in `docs/agents/delegation-log.md` (metadata only).
- Quota failure: defer code-adjacent work until the reset time. Timeout: keep the partial text, split the brief, retry once, then ask the owner.
- Templates for cards, change requests, PRs and the QA checklist are in `docs/templates/`. This block and the files under `.claude/agents/`, `.claude/skills/` and `docs/templates/` come from the agent toolkit; edit them there, not here (`.claude/workflow.lock.json` records the version).
<!-- agent-toolkit:end -->
