# CL-05B — Core: share-code codec, license, import-source check, heartbeat payload

| Field | Value |
|---|---|
| Owner | Claude Code |
| Stage | S1 |
| Status | In QA |
| Depends on | CL-02 (Done). Sequenced after CL-05 only because the lead works on one core card at a time; no code dependency. Input for one check: the Spike evidence for the `Authentication-Results` header (CL-01, `docs/spikes/RESULTS.md`) |
| Contract | `contract-v1` plus an additive `contract-v2` published by this card (see D7) |
| Plan references | `project_plan.md` FR-2.1 to FR-2.9, §6.2 (domain lock), §6.3 (`LicenseProvider`, three tiers), T-1, D-12, D-15, D-17, NFR-3 |
| Estimate | 1–2 (2 if the `RingDiff` extension of Q1 is bundled) |

## Goal
The pure parts of "share a ring with colleagues" and "know who installed the add-in" exist and are correct: a ring can be turned into a share code and back, tampering and bad input are rejected with a typed error, the licence check and the import-source check give clear verdicts, and the daily coverage heartbeat has a payload that carries nothing but what D-17 allows. After this card AG-10 (export and share), AG-11 (import) and AG-12 (heartbeat worker) can be written against real functions.

## Allowed paths
- `packages/core/src/{codec,license,importVerify,heartbeat}.ts`, `packages/core/src/index.ts` exports, `packages/core/src/core.ts` (wire `encodeRing` and `decodeRing`)
- `packages/core/test/**`
- `src/shared/contracts/**` (the additive `contract-v2`: types, schema, fixtures, mocks; lead-owned)
- `package.json` and the lockfile: one new runtime dependency, `fflate`, pinned to an exact version (explicit in D1)
- `docs/tasks/CL-05B.md`, `docs/tasks/BOARD.md`, `docs/agents/delegation-log.md`

## Inputs (read-only)
- `CoreApi.encodeRing` and `decodeRing`, `CodecError` (`malformed`, `tampered`, `expired`, `tooLarge`, `unsupported`) and `ShareCodePayloadSchema` (`keyId`, `ring`, `issuer`, `issuedAt`, optional `expiresAt`) of `contract-v1`.
- `packages/core/src/hash.ts` (`sha256`, `utf8`): pure JavaScript, usable in the JS-only runtime.
- `normalize.ts` for domains and addresses.

## Design decisions (lead, reversible until Ready)
- **D1 Dependency.** `fflate` (deflate and inflate), exact version, the only new runtime dependency. The send-time bundle (`launchevent.js`) imports only `packages/core` and `fflate`; nothing in this card may pull in another package.
- **D2 Where WebCrypto runs.** AES-GCM uses WebCrypto and the plan allows it only in the task pane (the JS-only runtime may lack it). So `codec` touches `crypto.subtle` only inside functions, never at import time, and the send-time path never calls it. The licence hash and the heartbeat hash use the pure `sha256`, which works in both runtimes.
- **D3 Code format (FR-2.1, FR-2.2).** `ShareCodePayload` as JSON, UTF-8, deflate, AES-GCM with a random 12-byte IV prepended, base64url, between `-----BEGIN MAILRING-----` and `-----END MAILRING-----`. The decoder removes all whitespace and line breaks, and the invisible characters that chat tools insert (no-break space, zero-width characters), before looking for the markers and the body. The key comes from a `KeyProvider` that the caller injects (`createCodec({ keys, now })`); core never reads a global or a build constant. Keys are identified by `keyId`, so a key can be rotated; an unknown `keyId` is `unsupported`.
- **D4 Limits and typed errors.** A code over a fixed size is `tooLarge` before any decoding. Inflate stops at a fixed output size (a decompression bomb is `tooLarge`, not an out-of-memory). No input makes the codec throw: bad framing, base64, JSON or schema is `malformed`; an AES-GCM failure is `tampered`; `expiresAt` before the clock is `expired`; a wrong version or unknown key is `unsupported`. Order of checks is fixed so one bad input always gives the same code.
- **D5 Licence (plan §6.3, D-12).** `LicenseProvider { check(profile): LicenseResult }` with the v1 implementation `BuildTimeDomainProvider`: the sender's domain, normalised, is hashed with a salt and compared with a list of salted hashes injected by the caller. `LicenseResult` carries `licensed` and a `reason`, plus key material derived from the match so that the share-code key depends on it (plan §6.2 item 4): an unlicensed build derives a wrong key and cannot read or write codes. A licence failure never blocks sending a mail (`AGENTS.md` §8, fail-open); it only disables share and import and is reported. A later `EntraTenantProvider` must fit the same interface without changing callers.
- **D6 Import-source check (FR-2.9, T-1).** `verifyImportSource(input)` is pure and takes the sender address, the internal domains, the raw `Authentication-Results` header lines and the `issuer` of the decoded code. It returns three independent verdicts plus warnings: sender is internal; DKIM or DMARC `pass` aligned with the sender's domain; `issuer` equals the sender. Only the topmost `Authentication-Results` header is read (the receiving server prepends its own; lower ones can be forged by the sender). A missing or unparseable header gives "unverified", not "failed". The parser follows RFC 8601 and is checked against fixtures taken from the Spike evidence of the real tenant before AG-11 starts.
- **D7 Heartbeat payload (D-17, NFR-3).** `buildHeartbeat({ mailbox, salt, bundleVersion, manifestVersion })` returns exactly `{ h, bundle, manifest }` where `h` is the hex SHA-256 of the salt and the normalised mailbox address. No recipient, subject, file name or ring appears anywhere. `shouldSendHeartbeat(lastSentAt, now)` is true once per 24 hours. The payload schema is exported so the Worker (AG-12) validates the same shape.
- **D8 `contract-v2` (additive).** New exported types and schemas: `LicenseResult`, `LicenseProvider`, `ImportSourceCheck`, `HeartbeatPayload`, plus the `createCodec` options. Fixtures and mocks are extended; `contract-v1` types do not change. If Q1 is accepted, `RingDiff` gains `internalDomain`, `firstTimeCheck`, field rules and tokens changes (gap G-1 of BOARD) in the same tag. The tag `contract-v2` and a BOARD note are published when this card merges; AG-10, AG-11 and AG-12 cards stay Draft until then.

## Requirements
1. `codec`: `encodeRing`, `decodeRing` per D3 and D4, wired into `createCore` so the contract's `CoreApi` methods stop using the stub.
2. `license`: interface, `BuildTimeDomainProvider`, the salted hash comparison, and the key derivation hook of D5.
3. `importVerify`: `verifyImportSource` and the `Authentication-Results` parser of D6.
4. `heartbeat`: `buildHeartbeat`, `shouldSendHeartbeat`, `HeartbeatPayloadSchema`.
5. `contract-v2` per D8, with fixtures (a valid code, a tampered code, an expired code, an oversize code, a code with injected whitespace) usable by the mocks.
6. Property-based tests (fast-check) for the round trip and the tamper cases; the compensating controls of `CLAUDE.md` apply.

## Acceptance criteria
- [x] AC-1 Round trip: for any valid ring and metadata, `decodeRing(encodeRing(...))` returns the same ring (property test); the output has the two marker lines and no character outside base64url in the body. Evidence: `codec.test.ts` "round-trips any valid ring (property)", "writes the markers...".
- [x] AC-2 Tolerance: inserting spaces, tabs, line breaks, no-break spaces and zero-width characters anywhere in the body, and wrapping the code in other text, does not change the result (property test). Evidence: `codec.test.ts` "ignores spaces, line breaks and invisible characters anywhere in the code (property)", "finds the code inside a mail", "strips quoting marks only at the start of a line".
- [x] AC-3 Tamper: flipping any single bit or character of the body, removing a marker, or cutting the code short never returns `ok`; the code is `tampered` or `malformed` as D4 orders (property test over positions). Evidence: `codec.test.ts` "never accepts a code with one character of the body changed (property)", "reports each region of the envelope with its own code".
- [x] AC-4 Limits: an oversize code and a decompression bomb give `tooLarge` without allocating the full output; an expired code gives `expired`; an unknown `keyId` gives `unsupported`; nothing throws (tests for each, plus a fuzz test with random strings). Evidence: `codec.test.ts` "limits and hostile content", "reads a hostile input of the largest size in linear time", the fuzz test; a 20 MB bomb stops at the cap.
- [x] AC-5 Licence: a domain on the list is licensed, any other, an empty list and a malformed profile are not; with the wrong licence the codec cannot decode a code made with the right one; the hash comparison does not depend on case, a trailing dot or punycode form of the domain. Evidence: `license.test.ts` (all cases, including the patched-out build that cannot read a code).
- [x] AC-6 Import-source check: table tests for internal and external senders, DKIM and DMARC pass, fail and none, domain misalignment, `issuer` mismatch, several `Authentication-Results` headers (only the topmost counts), and an unparseable header; plus fixtures from the real tenant once CL-01 has them. Evidence: `importVerify.test.ts` (header shapes of Exchange Online and of a gateway, only the topmost header counts). **Open:** fixtures from the real tenant wait for the CL-01 result.
- [x] AC-7 Heartbeat: the payload has exactly three fields and no recipient, subject, file name or ring text (test that serialises it and searches for the inputs); `h` changes with the salt and the mailbox, not with letter case; `shouldSendHeartbeat` is true at 24 h and false at 23 h 59 m. Evidence: `heartbeat.test.ts` (three fields, property test that no input text appears, 24 h boundary; versions are dotted numbers only after the advisory review).
- [ ] AC-8 `contract-v2` published and tagged after merge with a BOARD note; `contract-v1` tests unchanged and green; the dev server still runs on the mocks. Done in the PR: `RingDiff` v2, `devKeys`, live share-code fixtures. The tag follows the merge.
- [x] AC-9 Compensating controls on the PR: line coverage of `packages/core` at least 90 %, mutation score of the new files at least 80 % (reported), an advisory review through the job runner in plan mode (no blocker open), and the dependency line (`fflate`, exact version) stated in the PR. Evidence: line coverage of `packages/core` 100 %; mutation score 92.56 % over the six files (codec 88.69, importVerify 93.07, license 97.83, heartbeat 94.83, bytes 94.61, diff 93.02); new dependency `fflate` 0.8.3, exact. Advisory review through the job runner in plan mode: decode, encode, licence, heartbeat, regular expressions and the diff were reviewed without a blocker; the header-parsing and inflate-cap jobs timed out twice and are not covered (see Notes).
- [ ] AC-10 `npm run verify` passes; the send-time bundle imports nothing beyond core and `fflate` (checked by the build). `npm run verify` passes; the bundle check cannot exist yet (no send-time bundle until CL-07). Core runtime dependencies are only `valibot` and `fflate`.

## Edge cases
- A code pasted twice, or two codes in one text: the first complete block wins; a trailing second block is ignored, not an error.
- A code from another organisation (different key): `tampered` or `unsupported`, never a crash and never a hint of its content.
- `issuer` and `issuedAt` are untrusted display text; the codec validates length and shape only.
- Time comes from the injected clock; tests never read the real one.
- Mailbox addresses are never logged and never stored by this code; `StorageAdapter` owns persistence.

## Out of scope
- Build-time secret injection, obfuscation, the domain-lock pipeline and hosting (CL-09); the Worker endpoint and its CORS (AG-12); the share and import screens (AG-10, AG-11); reading the headers from Outlook (CL-06 adapter); when the handler sends the heartbeat (CL-08).

## Evidence required
- Test names for each AC, coverage and mutation output, the advisory-review job id in `docs/agents/delegation-log.md`, and the `contract-v2` BOARD note.

## Questions for the PO (answered 2026-11-05: yes to Q1 to Q4 as recommended, taken from "Ok, go" after the recommendations were listed)
- **Q1** Bundle the `RingDiff` extension (gap G-1: `internalDomain`, `firstTimeCheck`, field rules, tokens) into the `contract-v2` that this card publishes? It was deferred to "an additive `contract-v2` before AG-11" in CL-05 Q4. Recommendation: yes, one tag instead of two.
- **Q2** Approve D5's rule that a licence failure never blocks sending a mail and only disables share and import? Recommendation: yes (`AGENTS.md` §8).
- **Q3** Approve D6's trust rule: read only the topmost `Authentication-Results` header and treat a missing or unparseable header as "unverified" (a warning, not a block)? Recommendation: yes.
- **Q4** Approve D1 and D3: `fflate` as the only new runtime dependency (exact version), and the key model (`KeyProvider`, `keyId` rotation, key tied to the licence result)? Recommendation: yes.

## Notes
Advisory review (2026-11-05, plan mode, narrow jobs): no blocker in decode, encode, licence, heartbeat, the regular expressions (linear time, also measured by a test) or the diff. Findings acted on: the heartbeat version string allowed free text such as `john_doe` (now dotted numbers only); the diff compared attachment tokens and extensions differently from the attachment check (now the same normalisation). Findings rejected: field rules have no `regex` type (Antigravity assumed one), and a new ring has nothing to be compared with, so AG-11 must show all settings of a new ring in the preview. Not covered by the review after two attempts: `extractBody` and `inflateCapped` as a pair, `stripComments` and `parseAuthenticationResults`, and `judge` (the jobs went silent); they are covered by the unit tests and the mutation run only.

Written by Claude Code on 2026-11-05 as part of the execution plan, after the PO answered CL-05 Q1 and Q4 (split accepted, `RingDiff` deferred to `contract-v2`). Q1 to Q4 answered as recommended, so Status moved Draft → Ready on 2026-11-05. Work starts after CL-05 (PR #19) is merged, because both cards edit `packages/core/src/core.ts` and `index.ts`.
