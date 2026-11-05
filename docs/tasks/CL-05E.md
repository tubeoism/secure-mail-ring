# CL-05E — Codec hardening from the advisory re-review of CL-05B

| Field | Value |
|---|---|
| Owner | Claude Code |
| Stage | S1 |
| Status | In QA |
| Depends on | CL-05B (Done) |
| Contract | none (internal change; `contract-v2` unchanged) |
| Plan references | `project_plan.md` T-1; `AGENTS.md` §8 |
| Estimate | 0.25 |

## Goal
Close the two findings that the background re-review of CL-05B confirmed in `packages/core/src/codec.ts`, the part of the code that handles untrusted pasted text.

## Findings (re-checked against the code before acting)
1. **`inflateCapped` caps the result, not the work.** fflate emits output only after a `push` finishes, so a single push of a hostile deflate stream built the whole output (about 52 MB for a 51 KB input, measured; a 300 MB output for a 300 KB input) before the 512 KB cap was checked. Reached only after the AES-GCM tag has verified, so it needs the organisation key; the code size cap (64 K characters) also bounds it. Impact: memory and time spike in the task pane for an insider; no wrong result. Fix: feed the stream in pieces of 256 bytes so that output between two checks stays under about 260 KB. (The reviewer's own fix, the `size` option, was tested and does not change this.)
2. **`extractBody` started the block at the first BEGIN marker.** A BEGIN line copied twice in front of the real code put the second marker into the body (decoded to garbage, so `malformed` or `tampered`, and the real block was not reached). Fix: the block starts at the nearest BEGIN before the first END that follows a BEGIN. The first complete block still wins; a stray END in front is still skipped.

Considered and not changed: the reviewer also showed that a marker can be formed across line breaks and quote marks (`-----` / `> BEGIN MAILRING-----`). That is deliberate (chat tools wrap lines, FR-2.2), and a body is authenticated by AES-GCM, so text that looks like a block cannot be accepted as one. It can only make an attacker's own text the "first block", which an attacker could do by writing a complete block anyway.

## Allowed paths
- `packages/core/src/codec.ts`, `packages/core/test/codec.test.ts`, `packages/core/test/inflate.test.ts`, `docs/tasks/**`

## Acceptance criteria
- [x] AC-1 A 300 MB expansion is refused in under 2 s and with less than 40 MB of extra array buffers (`inflate.test.ts`); output of exactly the cap is accepted and one byte more is refused; invalid and truncated streams give `null`; ordinary data round-trips across many pieces (property).
- [x] AC-2 `extractBody`: stray BEGIN in front of the block, two complete blocks (first wins), stray END in front, BEGIN without END; and a property that no body ever contains a marker.
- [x] AC-3 All core tests pass; coverage and mutation gates hold for `codec.ts` (see the PR for the Stryker score).

## Notes
- Source: background review jobs `cb05b-r1-inflate` and `cb05b-r2-extract` (metadata in the delegation log). The third job, `cb05b-r3-judge` (header verdict), is reported separately.
