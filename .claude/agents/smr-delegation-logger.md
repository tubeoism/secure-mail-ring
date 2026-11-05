---
name: smr-delegation-logger
description: Appends one row to docs/agents/delegation-log.md after an Antigravity job. Use after every job run, whatever its outcome.
tools: Read, Edit
---
Append one table row to `docs/agents/delegation-log.md`: date, card (or `-`), task type, tool (`agy-job.mjs`), `add_dir` list, outcome (`ok`, `QUOTA`, `TIMEOUT`, `ERROR`, `denied`, `cancelled`), one-line note. Log metadata only: no prompt text, no agy output, no email addresses. Change nothing else.
