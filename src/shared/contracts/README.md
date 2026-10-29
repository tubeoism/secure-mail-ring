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

## Run the task pane in a browser
`npm run dev:taskpane` serves `src/taskpane/index.tsx` if it exists, otherwise a placeholder page, at http://localhost:3000. No Outlook needed.

## Something missing?
Write `docs/tasks/CCR-<nn>.md` from `docs/tasks/_CCR_TEMPLATE.md`, keep working against the mock, and do not work around the contract. Locale values go in `src/shared/i18n/locales/{vi,en}.json` (AG-07); keys are defined only in `i18nKeys.ts`.
