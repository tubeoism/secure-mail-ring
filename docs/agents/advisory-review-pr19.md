# Advisory review of PR #19 (CL-05 decision engine)

| Field | Value |
|---|---|
| Reviewer | Antigravity, read-only job in plan mode, run from a Claude session on the PO's machine |
| Subject | PR #19 head, `packages/core` (policy, evaluate, fingerprint, diff, suggest, expiry) |
| Verdict | No Blocker, no Major. 2 Minor, 4 Info |
| Re-check | Every finding was checked against the code by the lead (CL-05C card, table "Findings and decisions") |

## Findings carried into CL-05C
| # | Severity | Finding | Outcome |
|---|---|---|---|
| M-1 | Minor | Acknowledgement key does not include the finding's `messageKey` | Fix in CL-05C |
| M-2 | Minor | Unresolved-recipient token can collide with a resolved address starting with `?` | Fix in CL-05C |
| I-1 | Info | No test pins the no-ring sub-domain behaviour | Test in CL-05C |
| I-2 | Info | Same-name unresolved recipients share a key | Documented in CL-05 D7 by CL-05C |
| I-3 | Info | Real domain `fpt.vn` in `lookalike.test.ts:229` | Replaced in CL-05C |

The fourth Info item needed no action and is not reproduced here. The full text of the report stays with the job on the PO's machine.
