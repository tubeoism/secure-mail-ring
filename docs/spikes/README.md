# CL-01 spike runbook

Executed by the PO on Windows with classic Outlook (Microsoft 365 Apps). Claude reviews the evidence. Plan references: `project_plan.md` Stage 0 and §4.4. Card: `docs/tasks/CL-01.md`.

## Rules
- Use a test mailbox. Do not commit addresses, subjects or file names. Crop or redact screenshots before saving them under `docs/tasks/evidence/CL-01/`.
- Send test mail only to your own mailbox, plus one external address for Spike 1 and 2 if you need the external-recipient case.
- Record every result in `RESULTS.md` (one row per check). A failed check is a result, not an error: write it down and continue.
- The harness is throwaway (`spikes/`). It logs only event names, counts and timings.

## Order

| Step | File | Needs harness | Calendar time |
|---|---|---|---|
| 0 | `00-setup.md`: deploy, render manifest, sideload (this is the Day 1 gate) | yes | 1 h |
| 0b | `00-environment.md`: environment table | no | 15 min |
| 1–6 | `spike-1.md` to `spike-6.md` | yes | 0.5 day total |
| 7 | `spike-7.md`: 5-day stability log (start right after step 0) | yes | 5 working days |

Stop rule (plan gate): if step 0 fails because the tenant blocks custom add-ins, stop, record it, and report to Claude. Do not continue with other spikes.
