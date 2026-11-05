# AG-01C — Close the last QA findings of AG-01B (editor "+" clipped, two tests, audit script)

| Field | Value |
|---|---|
| Owner | Antigravity |
| Stage | S1 (follow-up to AG-01B) |
| Status | In QA |
| Depends on | AG-01B (PRs #37 and #40 merged; QA round 3 on PR #40) |
| Contract | `contract-v2`; no contract change in this card |
| Plan references | `AGENTS.md` §6 (Definition of Done), §7 (accessibility), `docs/agents/qa-checklist.md` C, E |
| Estimate | 0.25 day |

## Goal
Every control of the task pane is inside the viewport at 320 px and 450 px, including the "+" button of the member list in the ring editor, and the behaviours that QA round 3 found unprotected have a test that fails when they break. The PO approved a small follow-up instead of a fourth QA round on AG-01B ("Go", project thread, 2026-11-05). Source of the findings: https://github.com/tubeoism/secure-mail-ring/pull/40#issuecomment-6661140515

## Branch
`ag/AG-01C-clip`, from the current `main`. One PR, one card.

## Allowed paths
- `src/taskpane/**`
- `docs/tasks/evidence/AG-01/**` (the audit script is removed here, see requirement 3)
- `docs/tasks/AG-01C.md` (Status and Notes only), one new file `docs/tasks/changelog/<date>-AG-01C.md`

`src/test-setup/**` is lead-owned and read-only: use `renderApp`, do not edit it.

## Inputs (read-only)
- `src/test-setup/renderApp.tsx`, `src/test-setup/example.dom.test.tsx`, `src/taskpane/__tests__/behavior.dom.test.tsx` (pattern to follow).
- `docs/tasks/CCR-01.md`: the four keys are not published yet; do not touch `CCR_STRINGS`.

## Requirements
1. **M-3, editor "+" clipped.** In `RingEditorScreen.tsx` the "Thêm thành viên" row (`editor.member.add`, around line 361: `display: flex; gap: 6px` with the kind `Select`, the value `Input` and the "+" button) does not wrap. At 450 px the button's right edge is at 466 px, at 320 px the value input is clipped too, inside an `overflow: hidden` container, so the page does not scroll and the control cannot be reached. Make the row wrap or stack exactly as the Settings exceptions row does (`flexWrap: "wrap"`, `flex: "1 1 110px"`, `minWidth: 0` on the input, `minWidth: 32px` on the button). Then open every tab of the editor (Members, Subject Tag, Attachments, Ordering, Field Rules, Policy) and check that no other control is outside the viewport; QA measured only the Members tab as failing.
2. **Two missing tests** in `src/taskpane/__tests__/behavior.dom.test.tsx` (or a new `*.dom.test.tsx` next to it), using `renderApp` and `userEvent`:
   - the "Chỉnh sửa" button of a ring card opens the editor (QA mutation: delete `onNavigate("editor", ring.id)` at `RingsScreen.tsx:254`; today all tests stay green);
   - an invalid `?screen=` shows the ring list (`renderApp({ screen: "foo" })`), and an invalid language falls back to Vietnamese with no raw key on the page (`render(<App initialLanguage={"xx" as Language} />` inside the same wiring `renderApp` uses; `index.tsx` itself cannot be imported in a test). QA mutation: replace `if (raw === "vi" || raw === "en")` in `App.tsx` by `if (true)`; today all tests stay green.
3. **Audit script.** `docs/tasks/evidence/AG-01/audit_viewport.mjs` imports `puppeteer`, which is not a dependency, so nobody can run it, and it only measures page `scrollWidth`. Delete it. In the PR description put the table of what you measured by hand or with your own tool: every screen, every editor tab, 320 and 450 px, `vi` and `en`, for each "no control with `right > innerWidth`" and "no raw key on the page". Do not add a dependency. QA repeats the measurement independently.

## Acceptance criteria
- [ ] AC-1 In the Members tab of the editor, at 320 px and 450 px, in `vi` and `en`, the kind select, the value input and the "+" button are fully inside the viewport and reachable; no other control of any editor tab or any other screen is outside the viewport. Evidence: the table of requirement 3.
- [ ] AC-2 Both new tests exist and fail under the two mutations named in requirement 2 (state in the PR that you tried them, with the failing output).
- [ ] AC-3 `docs/tasks/evidence/AG-01/audit_viewport.mjs` is gone; no new dependency in `package.json` or the lockfile.
- [ ] AC-4 `npm run verify` passes; path guard green; the AC-2 `grep` of AG-01B still finds only `PrototypeToolbar`, the marker-line placeholder and the `CCR_STRINGS` constants.

## Edge cases
- Vietnamese placeholder text "Giá trị (email hoặc domain)" is longer than the English one; it must not push the "+" out of the viewport.
- A member value of 80 characters with no spaces in the list above the row must not widen the row.

## Out of scope
Switching `CCR_STRINGS` to `t(...)` (waits for `contract-v3`, CL-05D); any change to `src/test-setup/**`; new screens; visual polish.

## Evidence required
- Tests in `src/taskpane/__tests__/*.dom.test.tsx`; the measurement table and the mutation output in the PR description. If you take a screenshot of the editor at 320 px, save it as `docs/tasks/evidence/AG-01/editor-members.png`.

## Notes
- **M-3 (Editor members add-row clipping):** Fixed in `RingEditorScreen.tsx` by setting `flexWrap: "wrap"` on the row, `flex: "1 1 120px", minWidth: 0` on the kind select, `flex: "1 1 110px", minWidth: 0` on the value input, and `minWidth: "32px"` on the `+` button. All 6 editor tabs (Members, Subject Tag, Attachments, Ordering, Field Rules, Policy) and other screens verified without clipping at 320 px and 450 px across both languages (`vi` and `en`).
- **Tests for surviving mutations:** Added test in `behavior.dom.test.tsx` verifying navigation via the explicit "Chỉnh sửa" action button (kills mutation deleting `onNavigate("editor", ring.id)` in `RingsScreen.tsx:254`), and added tests verifying strict fallbacks for untrusted `?screen` (to 'rings') and untrusted `?lang` (to 'vi', killing mutation replacing allow-list with `if (true)` in `App.tsx:79`). Both mutations tested and confirmed to fail tests.
- **Audit script:** Deleted `docs/tasks/evidence/AG-01/audit_viewport.mjs`. Zero new dependencies added.
- **Verification:** `npm run verify` passed (30 test files, 627 tests passed; path guard green; check:i18n green with 126 keys).
