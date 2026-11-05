# Advisory review of merged PRs #9 (CL-03) and #10 (CL-04)

Compensating control from `CLAUDE.md` ("request an advisory review from Antigravity"), run retroactively through the bridge on 2026-11-05 under CL-11 decision D-6. Both PRs were already merged. The review is advisory and read-only; the card, the PR and the QA verdict remain the record.

## Method

- Pre-send check on both PR heads (`b853d93` for #9, `423ecc8` for #10): no real domain, secret, source map or `.env` in `packages/core`. `abccorp.vn` is the plan's example domain; long strings are punycode and SHA-256 test vectors.
- Each call was a `[REVIEW]` `agy_ask` with `add_dir` = `packages/core` of the detached PR-head checkout, one question per call, sequential (D-5).
- Calls with a broad scope, or on algorithmic code, timed out at 120 s with no output. Working pattern found: 20 to 60 lines per call, one concrete question, and the explicit sentence "no command execution, reason only by reading". Without that sentence agy tried to run commands, which headless mode auto-denies.
- Every Antigravity answer was treated as untrusted text. Each finding below was re-checked by Claude against the code, and two were checked by running code.

## Result

| PR | Verdict | Blockers | Major | Minor |
|---|---|---|---|---|
| #9 CL-03 | ADVISORY: no blockers (partial coverage) | 0 | 0 | 1 |
| #10 CL-04 | ADVISORY: no blockers (partial coverage) | 0 | 1 | 3 |

## Findings

| # | PR | Sev | Source | File | Finding | Claude check |
|---|---|---|---|---|---|---|
| F-1 | #10 | Major | Claude, while reading `lookalike.ts` for the brief (Antigravity was not asked) | `lookalike.ts` `splitRegistrable` (L36-46) | The registrable-domain heuristic only knows second levels `com net org gov edu ac co or ne go`. Under `.vn` it misses `id`, `io`, `biz`, `info`, `name`, `pro`, `health`, `int`. Effect: `abc.id.vn` and `evil.id.vn` both become registrable `id.vn`, so two unrelated organisations look like one trusted domain, and a look-alike such as `abccorp.id.vn` of a ring domain `abccorp.vn` gets primary label `id` and is never compared. The recipient is still flagged as outside the ring by `findOutsiders`; only the extra look-alike signal is lost | Confirmed by running `splitRegistrable` (`evil.id.vn`, `y.io.vn`, `a.biz.vn`, `p.info.vn` map to `id.vn`, `io.vn`, `biz.vn`, `info.vn`). The `abccorp.id.vn` case is inferred from that output, not run separately |
| F-2 | #10 | Minor | Antigravity | `history.ts` `recordAddresses` (L105-126) | The reader is opened once on the input state. A single call that records about 1,500 or more new addresses can evict the earliest of them again, and an address that sits in the old `previous` generation and recurs later in the batch is skipped for good. Needs an import near the 3,000 cap | Read the code: real but narrow. Failure direction is safe (a known address is treated as first-time, so an extra warning). Not reachable from a normal send (a few dozen recipients) |
| F-3 | #10 | Minor | Antigravity | `history.ts` `decodeBits` (L44-63) | Dangling bits at the end of a stored string are dropped silently instead of resetting the filter | Confirmed. No security effect; the filter only drives the first-time warning |
| F-4 | #10 | Minor | Antigravity, reframed by Claude | `fieldRules.ts` `evaluateFieldRules` (L25-45) | A rule with an unparseable pattern is skipped without any signal (documented in the docstring). If the editor does not validate patterns, a typo disables a rule silently, which conflicts with "never swallow an error silently" (`AGENTS.md` section 7) | Confirmed as designed. Suggested fix: expose a core helper that lists invalid rule patterns so AG-05 can block saving them |
| F-5 | #10 | Info | Claude | `lookalike.ts` `CONFUSABLES` | Greek alpha (U+03B1) and similar are not in the curated table (CL-04 Q3 accepted a subset). A single such substitution is still caught by the `editDistance` rule; several in one label could evade it | Confirmed by running `skeleton` |
| F-6 | #9 | Minor | Antigravity | `normalize.ts` `splitAddress` (L113-126) | No cap on the local part (64), and no rejection of characters such as `<`, `>`, `,`, `"` in labels or local part. Quoted local parts containing `@` and `Name <a@b.vn>` strings parse as errors or as odd domains | Confirmed. `findOutsiders` turns a parse error into `reason: "unresolved"` and an odd domain simply fails to match, so the direction is safe. Hardening only; Office.js supplies bare SMTP addresses |
| F-7 | #9 | Info | Antigravity | `order.ts` `keyOf` (L55) | `JSON.stringify` maps `undefined` and `null` to the same key, and the key is case-sensitive | `displayName` is a required string, so the collision is unreachable through the types. Case-sensitive is the strict, fail-safe choice for an "exact multiset" invariant. No change needed |
| F-8 | #9 | Known | Antigravity, already in the PR's open questions | `attachments.ts` `LETTER_OR_DIGIT` | `\p{L}\p{N}` needs ES2018. On a legacy JavaScript runtime this is a script-load `SyntaxError` | Not new. To be settled by the CL-01 runtime spike result before CL-06; fix is local to `attachments.ts` |

## False positives from Antigravity (rejected)

- "`ơ` and `ư` are not folded by `foldForMatch`": wrong. NFD gives `u` / `o` plus U+031B, inside the stripped combining range (checked in Node). Only `đ` needs the explicit map, which exists.
- "`new DataView(digest.buffer)` ignores `byteOffset`" (`history.ts` `positions`): not a defect today, `sha256` always returns a fresh 32-byte array.
- "`matchesPattern` may receive the wrong argument type" and "missing `cc`/`bcc` throws" (`fieldRules.ts`): the call passes a `RecipientEntry` as intended, and the throw needs input that violates the declared types.

## Verified correct by reading and, where noted, by running

- `punycodeEncode` and `adapt` against RFC 3492 sections 6.1 and 6.3 (Antigravity agrees; the PR also tests RFC vectors and Node `domainToASCII`).
- `normalizeDomain`: empty labels, trailing dot, 63-octet label, case and NFC handling.
- `isStrictSubdomain` and the indexed lookup in `createMemberIndex` (Claude read; whole-label matching holds).
- `tokenMatches`: both boundaries, overlapping occurrences, empty token, astral characters.
- `sameMultiset`: duplicates, renames, cross-field moves.
- `positions`: seven distinct in-range indices (odd step against a power-of-two size).
- `withinDistance`: 800,000 random cases (alphabet of 3, lengths 0 to 7, max 0 to 3) against a brute-force optimal-string-alignment distance, 0 mismatches. Antigravity timed out on this function twice; the fuzz run is Claude's evidence.

## Not covered by Antigravity

Calls on these timed out or were not made; Claude read them but has no independent second look:

- `order.ts`: `sortField`, `rankRecipient`, `sortRecipientsChecked`, `findShadowedPatterns`.
- `attachments.ts`: `checkAttachments`.
- `match.ts`: `findOutsiders` (the indexed `find` was checked only for `isStrictSubdomain`).
- `lookalike.ts`: `findLookalikes`, `skeleton` mapping order, `collectReferences`.
- `history.ts` lines 128-204: statistics, `parseKnownAddresses`, `findFirstTimeRecipients`.
- `hash.ts`: `sha256` (its tests use the standard NIST vectors).

## Proposed follow-up (needs PO approval)

One small Claude PR on the CL-04 area: extend the second-level list for `.vn` (and a few common national suffixes), add tests for F-1, add the invalid-pattern helper for F-4, and cap the local part for F-6. Findings F-2, F-3, F-5 and F-7 stay documented without code changes.
