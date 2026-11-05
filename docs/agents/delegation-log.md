# Delegation log (Antigravity bridge)

One row per bridge call. Metadata only: no prompt text, no output, no email addresses.

| Date | Card | Task type | Tool | add_dir | Outcome | Note |
|---|---|---|---|---|---|---|
| 2026-11-05 | CL-11 | validation T2 | bridge CLI | none | ok | Trivial echo prompt |
| 2026-11-05 | CL-11 | validation T5 | bridge CLI | temp sandbox | ok | Sentinel files in a scratch dir, nothing from the repo |
| 2026-11-05 | CL-11 | validation T4 | bridge CLI | `src/shared/contracts` | ok | Markdown skeleton from `index.ts` type names |
| 2026-11-05 | CL-11 | validation T3 | `agy_research` | none | ok | Echo query through the MCP server in a Claude Code session; returned `OK` |
| 2026-11-05 | CL-03 (PR #9) | advisory `[REVIEW]`, 4 core files | `agy_ask` | `packages/core` (PR head b853d93) | TIMEOUT | Idle 120s, no partial output. Pre-send grep of the head was clean |
| 2026-11-05 | CL-03 (PR #9) | advisory `[REVIEW]`, split brief (`normalize.ts`, `match.ts`) | `agy_ask` | `packages/core` (PR head b853d93) | TIMEOUT | Idle 120s, no partial output. D-4 retry used; escalated to PO |
| 2026-11-05 | CL-11 | bridge diagnostics, 3 calls | `agy_ask` | none; `packages/core` (trivial prompt; one 12-line file) | ok | Echo, review-marker echo, read `core.ts` export names. Showed the bridge and `add_dir` work and file reads work |
| 2026-11-05 | CL-03 (PR #9) | advisory `[REVIEW]`, narrow questions, 7 ok | `agy_ask` | `packages/core` (PR head b853d93) | ok | `adapt`, `punycodeEncode`, `normalizeDomain`, `splitAddress`, `isStrictSubdomain`, `sameMultiset`, `tokenMatches`. Prompt had to say "no command execution" |
| 2026-11-05 | CL-03 (PR #9) | advisory `[REVIEW]`, narrow questions, 3 more | `agy_ask` | `packages/core` (PR head b853d93) | TIMEOUT x3, ERROR x1 | TIMEOUT: `normalize.ts` L1-66, L68-132 and `match.ts` L14-90. ERROR: `normalize.ts` L32-66 (agy tried a command, auto-denied; fixed by the "no command execution" sentence) |
| 2026-11-05 | CL-04 (PR #10) | advisory `[REVIEW]`, narrow questions, 3 ok | `agy_ask` | `packages/core` (PR head 423ecc8) | ok | `history.ts` L18-76 and L79-127, `fieldRules.ts` L1-69 |
| 2026-11-05 | CL-04 (PR #10) | advisory `[REVIEW]`, 2 calls | `agy_ask` | `packages/core` (PR head 423ecc8) | TIMEOUT x2 | `lookalike.ts` L85-128 and L98-128 (distance function). Claude fuzz-checked it instead. Findings: `docs/agents/advisory-review-pr9-pr10.md` |
