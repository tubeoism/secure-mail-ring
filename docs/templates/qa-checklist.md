# QA Checklist — Antigravity PRs (skeleton)

Used by the lead (Claude Code) on every `ag/*` PR. Walk every section; record findings with severity and file:line. Copy this file to `docs/agents/qa-checklist.md` and add the project's own sections where marked.

| Severity | Meaning | Blocks PASS? |
|---|---|---|
| Blocker | Contract, security, privacy or acceptance-criterion failure | Yes |
| Major | Bug, missing state, missing or weak test | Yes |
| Minor | Naming, style, small readability point | No |

## A. Scope and process
- [ ] PR maps to exactly one card; card status was `Ready` and dependencies `Done`.
- [ ] Changed files are all inside the card's allowed paths (path guard green).
- [ ] No new dependency; lockfile unchanged unless the card says otherwise.
- [ ] PR template fully filled; evidence linked for every acceptance criterion.

## B. Contract compliance  *(project-specific: add the rules of your published contracts)*
- [ ] …

## C. Correctness against the card
- [ ] Each acceptance criterion reproduced by running the code, not only read.
- [ ] Empty, loaded, error and loading states exist and behave (for UI work).
- [ ] Edge cases named in the card are covered.

## D. Security and privacy  *(project-specific: add the rules of your threat model)*
- [ ] No `eval`, `new Function`, or unsanitised HTML insertion.
- [ ] Untrusted input rendered as text only.
- [ ] …

## E. Text and accessibility  *(project-specific)*
- [ ] …

## F. Tests
- [ ] Tests cover the main states and the acceptance criteria.
- [ ] Tests assert behaviour, not implementation details or snapshots only.
- [ ] No skipped or focused tests.

## G. Maintainability
- [ ] Names and structure match the surrounding code.
- [ ] No dead code, commented-out code or out-of-scope refactors.

## Review comment format

```
### Blockers
- path/to/file:42 — <problem>. Fix: <concrete change>.
### Majors
- ...
### Minors (non-blocking)
- ...

QA: PASS | QA: CHANGES REQUESTED | QA: BLOCKED (CCR-nn)
```

Round limit: 3. After the third round without PASS, escalate to the owner with a summary of the open findings.
