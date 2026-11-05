# PLAN: change log moves from one table in BOARD.md to one file per event

PRs that each appended a row to the end of `BOARD.md` conflicted whenever two were open together (seen on the CL-04B and CL-13 PRs, on PR #19 against #18 and #20, and on PR #21). New events go in `docs/tasks/changelog/`; the old table is frozen in `0000-before-per-event-files.md`. A `.gitattributes` merge driver was not an option: the GitHub merge button ignores it.
