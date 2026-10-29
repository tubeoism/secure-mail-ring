# Spike 6: Acknowledge flow

Plan: Stage 0 spike 6, FR-7.5. Decision fed: whether the strict Acknowledge model is implementable as designed.

1. Press **ack**. Compose a message to yourself and press Send.
2. Expect a dialog with the error text and a button labelled "Open pane". Record: does the button appear; does it open the task pane (commandId).
3. In the pane press **Acknowledge (sessionData)**, then Send again. Expect the message to send and the log to show `spike6.sendAfterAck`.
4. Close the compose window without sending, reopen the draft, press Send: is the acknowledgement still remembered or reset? Record.
5. Record whether any event or log entry distinguishes "Send Anyway" from a normal send (FR-7.5).

Pass: steps 2 and 3 work. Anything else is a documented limitation with a fallback chosen by Claude.
