# CL-13 results (2026-11-05, PO machine)

Source repository: `tubeoism/antigravity-agent-toolkit` (private). PR #1 merged at 05:36 UTC; tag `v0.1.0` and branch `stable` point at the merge commit `3e3a9df`.

| Check | Result | Evidence |
|---|---|---|
| AC-1 policy, AC-2 runner and guard | Pass: 124 tests in the toolkit; the old guard and runner tests run unchanged against the Secure Mail Ring policy (`plugins/agy-bridge/test/fixtures/smr-policy.json`); new tests cover deny by default, an invalid policy, the built-in floor, the review marker, and the hook as a process | `npm test` in the toolkit |
| AC-3 sync | Pass: 25 tests (fresh copy, repeat run, update, local edit and conflict, force, CRLF, orphan, damaged lock, marker block, command line, `--open-pr` command order, dirty tree, failing step). Not yet run against this repository: that is part of the migration PR | `tools/test/sync.test.mjs` |
| AC-4 manifests | Pass: `claude plugin validate .` (marketplace). The plugin-folder check applies the public directory's listing rules (long README, licence, icon) and is not used | `npm run validate` |
| AC-5 install and smoke job, with `--plugin-dir` | Pass: hook refused a direct `agy -p`; `${CLAUDE_PLUGIN_ROOT}` was replaced by the real path in the skill text; job `smoke-plugin` finished with `OK` | headless `claude -p` in a throwaway project that held a policy file |
| AC-5 install and smoke job, through the marketplace | Pass: `claude plugin marketplace add tubeoism/antigravity-agent-toolkit#stable` (private repository, cloned over the PO's GitHub login), `claude plugin install agy-bridge@antigravity-agent-toolkit --scope project`, version 0.1.0 enabled. Without `--plugin-dir`: the hook refused a direct `agy -p`; the skill gave the cache path `.../.claude/plugins/cache/antigravity-agent-toolkit/agy-bridge/0.1.0/scripts/agy-job.mjs`; the model ran it as `node "<that path>" run smoke-market`, the hook allowed it, exit 0, result `OK`, 2 steps | same throwaway project |
| Clean-up of the trial | The plugin was uninstalled from the throwaway project and the marketplace removed from the user settings; `claude plugin list` and `marketplace list` show neither. Claude Code left its cache folder `~/.claude/plugins/cache/antigravity-agent-toolkit` | `claude plugin list` |

Not done yet: AC-6 (an update reaching a machine through `claude plugin update`, and a second repository through the sync PR), AC-7 (cloud session check) and AC-8 (the migration PR in this repository). The migration needs PR #14 merged first, because the scripts it replaces live there.
