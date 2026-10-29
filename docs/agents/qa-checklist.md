# QA Checklist — Antigravity PRs

Used by the lead (Claude Code) on every `ag/*` PR. Walk every section; record findings with severity and file:line.

| Severity | Meaning | Blocks PASS? |
|---|---|---|
| Blocker | Contract, security, privacy, or acceptance-criterion failure | Yes |
| Major | Bug, missing state, missing or weak test | Yes |
| Minor | Naming, style, small readability point | No |

## A. Scope and process
- [ ] PR maps to exactly one card; card Status was `Ready` and dependencies `Done`.
- [ ] Changed files are all inside the card's Allowed paths (path guard green).
- [ ] No new dependency; lockfile unchanged unless the card says otherwise.
- [ ] PR template fully filled; evidence linked for every acceptance criterion.

## B. Contract compliance
- [ ] No `Office.*`, `window.localStorage`, `sessionStorage`, or `fetch` outside what the card allows.
- [ ] Uses `@smr/core` public exports only — no deep imports into core internals.
- [ ] Uses `OfficeAdapter` / `StorageAdapter` as specified; handles their error results.
- [ ] No duplicated business logic (matching, ordering, policy, codec) in the UI — the UI displays what core returns.

## C. Correctness against the card
- [ ] Each acceptance criterion reproduced by running the code (dev server with mocks, or tests), not only read.
- [ ] Empty, loaded, error, and loading states exist and behave.
- [ ] Edge cases named in the card are covered.

## D. Security and privacy
- [ ] No `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `new Function`.
- [ ] Untrusted input (mail content, pasted codes, imported rings) rendered as text only.
- [ ] No email address, subject, or file name logged or persisted outside `StorageAdapter`.
- [ ] Heartbeat worker (if any): payload exactly matches the plan's D-17 schema; no extra fields; rate-limited; CORS limited to the hosting origin.

## E. i18n and accessibility
- [ ] No hard-coded user-visible strings; every key has `vi` and `en` values; key-completeness test green.
- [ ] Texts sent to Smart Alerts respect the length limit asserted in tests.
- [ ] Keyboard navigation works; controls have labels; focus is visible; colour is not the only signal for severity.

## F. Tests
- [ ] Component tests cover the main states and the acceptance criteria.
- [ ] Tests assert behaviour, not implementation details or snapshots only.
- [ ] No skipped or focused tests (`.skip`, `.only`).

## G. Maintainability
- [ ] Names and structure match the surrounding code.
- [ ] No dead code, commented-out code, or out-of-scope refactors.

## Review comment format

```
### Blockers
- path/to/file.tsx:42 — <problem>. Fix: <concrete change>.
### Majors
- ...
### Minors (non-blocking)
- ...

QA: PASS | QA: CHANGES REQUESTED | QA: BLOCKED (CCR-nn)
```

Round limit: 3. After the third round without PASS, escalate to PO with a summary of the open findings.
