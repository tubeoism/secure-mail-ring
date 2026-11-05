# Contract v1 — how to use it

Audience: Antigravity (feature developer). Rules: `AGENTS.md` section 3.

## Import surface
Import everything from one place:

```ts
import { fixtures, stubCore, MockOfficeAdapter, MockStorageAdapter, createTranslator, type Ring } from "../shared/contracts";
```

Never import `Office.*`, `window.localStorage`, or files under `packages/core/src` directly.

## What is in the contract
| Piece | Where | Notes |
|---|---|---|
| Types, `smr/1` schema, `parseRing` / `parseSettings` / ... | `@smr/core` (`packages/core/src/model`) | Parsers return `Result`, never throw. Everything read from mail items, codes or imports is untrusted. |
| `CoreApi` (evaluate, sort, diff, codec, ...) | `@smr/core` (`api.ts`) | Real implementations land in CL-03 to CL-05 with the same signatures. |
| `stubCore` | `contracts/stubCore.ts` | Fixture-backed. Use it in screens until the real core is wired. Not a reference implementation. |
| `OfficeAdapter`, `StorageAdapter` | `contracts/adapters.ts` | Results are values: `{ ok: true, value } or { ok: false, error }`. Errors carry an i18n key. |
| `MockOfficeAdapter`, `MockStorageAdapter` | `src/shared/office`, `src/shared/storage` | In memory. The mock office adapter records calls and can be told to fail. |
| Fixtures | `contracts/fixtures/*.json` via `fixtures` | All fictional. 6 rings (Strict, expired, field rules, conflicting rules, 500-member ring), settings, compose snapshots, findings (every kind x mode), canned evaluations, share codes. |
| i18n | `contracts/i18nKeys.ts`, `createTranslator` | `t("typo")` fails typecheck. Missing runtime value renders the key. |

## Contract v2 (tag `contract-v2`, CL-05B) — additions for export, import and the heartbeat
All additive; nothing of v1 changed. Import from the same place.

| Piece | Use |
|---|---|
| `core.encodeRing(ring, { issuer, issuedAt })`, `core.decodeRing(text)` | Real share-code codec in the contracts `core`, running on the public `devKeys` so that a plain browser round-trips a ring. Results are `Result`s with a `CodecError` code: `malformed`, `tampered`, `expired`, `tooLarge`, `unsupported` (map each to its own i18n text). Pass the pasted text as it is; whitespace, line breaks and quoting marks are tolerated. |
| `buildLiveShareCodes()`, `LIVE_SHARE_CODE_ERRORS` | Real codes for the import screen and its tests: `valid`, `spaced`, `quoted`, `tampered`, `expired`, `oversize`, `foreignKey`, and the error each broken one must give. |
| `RingDiff` (from `core.diffRings`) | Besides members and modes it reports `internalDomainChange`, `firstTimeCheckChange`, `ignoreInlineChange` (each `{ from, to, loosened }` or `null`), `addedFieldRules` / `removedFieldRules`, `addedTokens` / `removedTokens`, `addedExemptExtensions` / `removedExemptExtensions`. Highlight every `loosened` change and every added or removed rule, token and exemption. For a **new ring** there is nothing to compare with: show all settings of the incoming ring in the preview. |
| `verifyImportSource({ senderAddress, internalDomains, authenticationResults, issuer })` | For "Import from this email". Returns `senderInternal`, `authentication` (`pass`, `fail`, `unverified`), `issuerMatchesSender`, `warnings` (`senderExternal`, `authFailed`, `authUnverified`, `issuerMismatch`) and `trusted`. Show each warning next to the diff; `trusted` is an indicator, never a reason to import without the preview. |
| `buildHeartbeat`, `HeartbeatPayloadSchema`, `shouldSendHeartbeat` | For the heartbeat Worker (AG-12): the record is `{ h, bundle, manifest }` and nothing else; validate incoming records with the schema. |
| `devKeys`, `foreignDevKeys` | **Public development keys, not secrets.** Dev server and tests only. The production wiring (licence provider, organisation secret) is the lead's work; screens never build keys. |

## Run the task pane in a browser
`npm run dev:taskpane` serves `src/taskpane/index.tsx` if it exists, otherwise a placeholder page, at http://localhost:3000. No Outlook needed.

## Something missing?
Write `docs/tasks/CCR-<nn>.md` from `docs/tasks/_CCR_TEMPLATE.md`, keep working against the mock, and do not work around the contract. Locale values go in `src/shared/i18n/locales/{vi,en}.json` (AG-07); keys are defined only in `i18nKeys.ts`.
