# Spike 3: roamingSettings in the JS-only runtime, capacity

Plan: Stage 0 spike 3. Decision fed: ring storage budget (plan §5.4, D-10).

1. In the pane press **Measure capacity**. Record the reported last successful size and first failing size (KB).
2. Confirm the handler can read and write: press **allow**, send a message, and check the log shows the entry written by the handler (written inside the JS-only runtime, not the pane).
3. Close and reopen Outlook, confirm the mode and log persist.

Note: the harness writes incompressible data, so the figure is a lower bound for compressed ring data. Claude converts it into a maximum number of rings with real fixtures in CL-02.
