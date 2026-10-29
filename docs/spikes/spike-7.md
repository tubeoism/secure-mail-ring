# Spike 7: five-day sideload stability

Plan: Stage 0 spike 7 and gate. More than one unexplained deactivation in 5 working days means plan B (COM, §4.4).

Start straight after step 0. Keep mode **block** during the test so activation is visible (use a message to yourself).

| Day | Action | Log in `RESULTS.md` |
|---|---|---|
| 1 | Install, send one test message | Did Smart Alerts fire? Time of day |
| 2 | Restart the computer, then send a test message | Fired? |
| 3 | Deploy a changed `launchevent.js` (visible change in the dialog text), no manifest change. Restart Outlook | Does the new text appear, or the old one (cache)? How long until it updates? |
| 4 | Render the manifest with a new version, remove the add-in, install the new one | Fired? Any duplicate add-in? |
| 5 | Delete `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef`, restart Outlook, send | Add-in still installed and firing? |

Also each day: once in the morning (first send after opening Outlook) and once in the afternoon. A day with a miss gets the time, Outlook state (just started, long running, resumed from sleep) and any warning banner text.
Counting rule: a send where the handler should have fired and did not, without a known cause (host paused on purpose, offline on purpose), is one unexplained deactivation.
