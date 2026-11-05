# CL-12 results (2026-11-05, PO machine)

Environment: Windows 11, `agy` 1.5.0, Node 24.13 for the runner. Job files live in `.tools/agy-jobs/` (git-ignored); no prompt text or agy output is stored in the repository.

| Check | Result | Evidence |
|---|---|---|
| `agy -p` with `--output-format stream-json` over plain pipes (no PTY) | Pass: exit 0, 5 events (`init`, 3 × `step_update`, `result`), first event after about 2.6 s, total about 6 s | Node probe, trivial prompt, empty scratch `cwd` |
| agy honours the process `cwd` | Pass: `init.cwd` equals the scratch directory. In the earlier bridge probe (no workspace) it was the repo root | Same probe; bridge probe in the CL-11 follow-up |
| Final event carries the answer and a status | Pass: `result.status` `SUCCESS`, `result.response`, `conversation_id` | Same probe |
| Runner end to end, real agy, started as a background shell command | Pass: job `smoke-ok`, `"workspace":"none"`, exit 0, `result.md` = `OK`, 2 steps, the session was woken when the process exited, `status` reported `finished` | `node scripts/agy-job.mjs run smoke-ok`, then `result` and `status` |
| Guard refusal end to end | Pass: job `smoke-denied` (`packages/core` without `[REVIEW]`) exited 14 with state `denied`; agy was never started (`agyPid` null) | `node scripts/agy-job.mjs run smoke-denied` |
| Unit tests | Pass: `npx vitest run scripts`, 46 tests (20 runner, 21 guard, 5 path guards) | CI |
| Hook on the shell route | Pass in use: the hook rejected one of my own commands whose heredoc text started a line with the agy command word, then accepted the runner commands | Session log |

Not covered here: a real stall of agy (the unit tests simulate it with a fake agy that goes silent), and the confinement test T7 for a write mode.
