# CL-05D — Contract v3: keys and helpers for export, import and the heartbeat Worker

| Field | Value |
|---|---|
| Owner | Claude Code |
| Stage | S1 (before AG-07 starts and before AG-10 to AG-12) |
| Status | Draft |
| Depends on | CL-05B (Done, tag `contract-v2`) |
| Contract | `contract-v3` (additive) |
| Plan references | `project_plan.md` FR-2.3, FR-2.4, FR-2.6 to FR-2.9, D-15, D-17; `AGENTS.md` §3 and §6.5 |
| Estimate | 0.5 to 1 |

## Goal
The three cards AG-10, AG-11 and AG-12 can be built against the contract without a Contract Change Request, and the catalogs of AG-07 cover every text the screens need. One tag, `contract-v3`, instead of one per gap.

## Allowed paths
Lead-owned paths only: `src/shared/contracts/**`, `packages/core/**`, `scripts/i18n-check.mjs`, root config (`tsconfig.json`, `vitest.config.ts`, `eslint.config.js`) for the Worker folder, `docs/tasks/**`.

## Scope
1. **New i18n keys** (additive, `contract-v3`). Texts are written by AG-07; this card defines key, meaning and allowed parameters.

   | Key | Meaning | Parameters |
   |---|---|---|
   | `share.error.encode` | The code could not be created; try again | none |
   | `share.error.tooLarge` | The ring is too large for one code; split it | none |
   | `share.email.subject` | Subject of the share email | `{ring}` |
   | `share.email.body` | Text above the code in the share email, with the three steps to import it. The code is added below it by the screen | `{ring}` |
   | `share.recipients` | Label of the recipient list in the share screen | none |
   | `share.recipients.none` | No colleague in the internal domain is listed in this ring | none |
   | `import.error.tooLarge` | The pasted text or code is too large | none |
   | `import.error.unsupported` | Code from another organisation's build, or from a newer version | none |
   | `import.issuer` | Label "created by" | none |
   | `import.issuedAt` | Label "created on" | none |
   | `import.new` | This is a new ring; all its settings are shown below | none |
   | `import.same` | Same revision as the ring you already have; nothing to import | none |
   | `import.done` | The ring was imported | none |
   | `import.diff.external` | Marks a member outside the internal domain | none |
   | `import.source.pasted` | The source of a pasted code is not checked | none |
   | `import.warning.senderExternal` | Sender is outside the internal domain | none |
   | `import.warning.authFailed` | The mail failed DKIM or DMARC | none |
   | `import.warning.authUnverified` | The mail has no usable authentication result | none |
   | `import.warning.issuerMismatch` | The code says it was created by someone other than the sender | none |

   Plus the keys that the AG-01 QA (round 1, PR #29) found missing for accessible names and placeholders, as the CCR from Antigravity lists them. They are added in the same change; this card stays `Draft` until that CCR exists.
2. **Header helper in the core.** `headerValues(rawHeaders, name)` returns the unfolded values of every header called `name` (case-insensitive), topmost first, so a screen passes `OfficeAdapter.getInternetHeaders()` output into `verifyImportSource` without parsing headers itself. Handles CRLF and LF, folded continuation lines, a size cap, and never throws. Table tests, a property test (folding the same header never changes its value) and a mutation score above 80 %.
3. **Sender in read mode.** `OfficeAdapter.getSenderAddress(): OfficeResult<string>` (additive; `MockOfficeAdapter` gets it, with a way to set it in tests). The real adapter in CL-06 reads `item.from.emailAddress`. Without it the import screen would have to parse the `From` header itself.
4. **Heartbeat parser.** `parseHeartbeat(input: unknown): Result<HeartbeatPayload, HeartbeatError>` (new code `invalid`) over `HeartbeatPayloadSchema`, so the Worker does not import `valibot` itself. Tests reuse the schema cases of `heartbeat.test.ts`.
5. **Worker folder in the toolchain.** `worker/heartbeat/` joins `tsconfig` references, the Vitest `include` (`worker/**/test/**/*.test.ts`) and ESLint, with an empty `src/index.ts` and a `tsconfig.json`, so AG-12 can write and test inside its folder without touching root config. `worker/heartbeat/**` is already Antigravity-owned in `AGENTS.md` §2 (decision D-17), so the path guard is unchanged.
6. **Documentation.** Update `src/shared/contracts/README.md` (Contract v3 section), the key count in `docs/tasks/AG-07.md`, the `ALLOWED_PLACEHOLDERS` table of `scripts/i18n-check.mjs` for the `{ring}` keys, BOARD, and one change-log file.

## Acceptance criteria
- [ ] AC-1 `I18N_KEYS` holds the new keys, each on its own line; `npm run check:i18n` still passes (gaps against the catalogs are warnings until AG-07).
- [ ] AC-2 `ALLOWED_PLACEHOLDERS` lists `{ring}` for `share.email.subject` and `share.email.body` and nothing else new; the i18n check has a test for it.
- [ ] AC-3 `headerValues` is exported from `@smr/core` with table, property and mutation tests (coverage of the file at 100 % of lines, mutation score at least 80 %).
- [ ] AC-4 A test feeds a raw header block from `fixtures/` through `headerValues` into `verifyImportSource` and gets `trusted` for a good message and a warning for a forged lower header.
- [ ] AC-4a `parseHeartbeat` is exported, accepts a record from `buildHeartbeat`, and rejects extra fields, non-hex hashes, free-text versions and non-objects without throwing.
- [ ] AC-4b `MockOfficeAdapter.getSenderAddress()` returns a configurable address and can be made to fail; the interface and mock are documented in the contract README.
- [ ] AC-5 `worker/heartbeat/src/index.ts` is typechecked, linted and picked up by `npm test`; a placeholder test passes.
- [ ] AC-6 Contract README, AG-07 key count, BOARD and the change-log file are updated; tag `contract-v3` is pushed after merge.
- [ ] AC-7 Coverage and mutation gates of `CLAUDE.md` hold for `packages/core`; advisory review requested.

## Out of scope
- Writing any text value (AG-07); any UI; the Worker code (AG-12).

## Notes
- Open question for PO: the internal domain of the organisation is not in the repository (domains are hashed, plan section on the domain lock). Screens take it as the domain of `OfficeAdapter.getUserAddress()`. If the organisation has several mail domains, a list will have to come from the licence result (CL-09). The cards AG-10 and AG-11 use the single domain and say so.
