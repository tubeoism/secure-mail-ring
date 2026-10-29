# Spike 1: OnMessageSend, requirement sets, Markdown

Plan: Stage 0 spike 1. Decision fed: plan A or B, `SoftBlock`, message format.

1. Open a new message, open "Spike pane", press **Check requirement sets**. Screenshot the output (host, platform, version, one line per set).
2. Press **allow**, send a message to yourself. Open the pane, **Refresh log**: expect an `OnMessageSend` entry with `mode=allow`.
3. Press **block**, send. Record: dialog text, whether Markdown rendered (bold, second line), which buttons the dialog shows.
4. Press **prompt**, send. Record: does the dialog offer Send Anyway; does it send after you choose it.
5. Repeat 2 to 4 once with new Outlook as a smoke test (not an acceptance criterion).

Pass: step 2 and 3 behave as described; the requirement sets table is filled.
