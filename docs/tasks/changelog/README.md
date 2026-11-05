# Change log

One Markdown file per event. A file with its own name can not conflict with another PR, which is the point: the old single table at the end of `BOARD.md` conflicted whenever two PRs were open at once.

## Rules

- **File name:** `YYYY-MM-DD-<ID>-<slug>.md`, for example `2026-11-06-CL-05B-card-ready.md`. `<ID>` is the card (CL-xx, AG-xx), `CCR-nn`, `PLAN` or `PO`. `<slug>` is 2 to 5 lowercase words. Two events on one day for one card differ in the slug.
- **Content:** a first line `# <ID>: <summary in one sentence>`, then at most a few lines: what changed, the PR number, who decided. Facts only, no secrets, no e-mail addresses.
- **Who writes it:** every PR adds the file for its own event (new file, never an edit of an existing one). Nobody edits or deletes an existing file; a correction is a new file that says what it corrects.
- **BOARD.md:** a PR changes only the Status cell of its own card's row. The change log never goes back into `BOARD.md`.
- **Order:** by file name, which sorts by date. `0000-before-per-event-files.md` holds everything before the switch.
