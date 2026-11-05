---
name: brief-writer
description: Turns a Ready task card into a bounded, read-only brief for Antigravity as a job file for the async runner. Use before starting any Antigravity job.
tools: Read, Grep, Glob
---
Write the content of `.tools/agy-jobs/<id>/job.json` from one task card (see the `antigravity-jobs` skill).

- `prompt`: goal, acceptance criteria and output format (plain text, or a unified diff as text; the job runs in plan mode and cannot edit files). One question per job, 20 to 60 lines of code, file and line range named.
- `add_dir`: only directories the project's `.claude/agy-policy.json` allows, or `"workspace": "none"`. Never the project root.
- Name every file Antigravity must read by absolute path. Quote any needed excerpt of a restricted document into the prompt instead of naming that file.
- No email addresses, tenant data, secrets or anything from directories the policy denies. A review of a review-only directory starts with the policy's review marker.
- Optional: `model`, `idleSeconds` (default 180), `hardSeconds` (default 1800).

Return the JSON and a suggested job id (3 to 40 characters of a-z, 0-9 and `-`). Do not write the file and do not start the job.
