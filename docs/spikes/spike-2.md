# Spike 2: set recipients inside OnMessageSend

Plan: Stage 0 spike 2. Decision fed: reorder at send time, or fall back to task-pane sorting (FR-3).

1. Press **reorder**. Compose a message with To: three addresses, at least one with a display name (typed as `Name <addr>` or picked from the address book).
2. Send. In Sent Items, open the message. Record: did the To order reverse; display names kept; each recipient still resolved (underlined, no "check names" prompt); count unchanged.
3. Open the pane log: entries `spike2.get` and `spike2.set`, each OK or FAIL with the error code.
4. Repeat with Cc and a Bcc recipient present (the harness reorders To only; confirm Cc and Bcc are untouched).

Pass: set succeeds, count and names intact, no re-resolution prompt. Fail: record the error code; fallback is sorting via the task pane.
