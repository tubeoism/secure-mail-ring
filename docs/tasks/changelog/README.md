# Board change log (one file per PR)

Why: the old change log was one table at the end of `BOARD.md`; every PR appended a row and parallel PRs conflicted on every merge (CL-04D).

## Rule
- Each PR that changes a card's status, a contract, or the plan adds **one new file** here. Never edit another PR's file.
- Name: `YYYY-MM-DD-<ID>.md` (card ID of the PR; add `-b`, `-c` if the same card needs a second entry on the same day).
- Content: a single paragraph, no front matter, same style as the old rows: what changed and why, with PR numbers.
- Status cells in the tables of `BOARD.md` are still edited in place. Two PRs touching the same row can still conflict; merge them one at a time.
- Older history: [`../CHANGELOG.md`](../CHANGELOG.md) (closed, do not append).
