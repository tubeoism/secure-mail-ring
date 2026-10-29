# Spike 4: fail modes

Plan: Stage 0 spike 4. Invariant (AGENTS.md §8): send-time failures must never block sending.

For each case, try to send a message to yourself and record: sent or blocked, any dialog text, time to send.

| Case | How |
|---|---|
| Handler throws | Press **throw**, send |
| Offline | Mode **allow**, disconnect the network, send (message sits in Outbox, note whether the handler ran) |
| Host 404 | Pause the Pages deployment or deploy an empty folder, restart Outlook, send |
| Slow host | Not required; note any timeout text if you see one |

Pass: every case sends (SoftBlock fail-open). Any block is a plan finding to escalate.
