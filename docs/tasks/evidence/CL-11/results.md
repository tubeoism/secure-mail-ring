# CL-11 validation results (2026-11-05, PO machine)

Environment: Windows 11, `agy` 1.5.0, Python 3.14 (PO choice A), `agy-headless-bridge` 1.3.0 and `pywinpty` 3.1.2 in `.tools/agy-bridge/venv`.

| Test | Result | Evidence |
|---|---|---|
| T1 `agy --version` | Pass: `1.5.0`, exit 0. OAuth login is cached; the token file was not opened. | command output |
| T2 bridge round trip | Pass: prompt "reply with exactly: OK" returned `OK`, exit 0 (non-empty, so the isatty issue is bypassed on Windows). | `agy-bridge --no-workspace "reply with exactly: OK"` |
| T3 tools visible in Claude Code | **Pending PO action.** `.mcp.json` and the hook are in place. The server answers `initialize` and `tools/list` (`agy_ask`, `agy_research`) when driven directly. Claude Code must reload the project and PO must approve the `antigravity` server, then `/mcp` is checked. | JSON-RPC probe |
| T4 boilerplate task in an allowed directory | Pass with a limit: the hook allows `src/shared/contracts`; agy returned a markdown skeleton as text. It cannot write files (see findings 2 and 3). | command output |
| T5 forbidden directory | **Fail at agy level, mitigated at hook level.** See finding 1. | sentinel test |
| T6 timeout and quota | Pass at bridge level: idle timeout exits 1 with a clear message; `_call_agy` maps timeout (partial kept), quota (reset seconds) and exit errors to `isError` results with `[agy-mcp] TIMEOUT/QUOTA/ERROR` markers. Quota was simulated, not triggered. | mock run |
| Hook and path guard | Pass: `npx vitest run scripts` 22 tests; `npm run verify` green. | CI |

## Findings

1. **`add_dir` is not a read boundary.** With `add_dir` set to folder A, agy printed a sentinel stored in sibling folder B when the prompt named its absolute path. Reads of named paths are not gated. Consequence: the real controls are what the prompt names and which content Claude places in it. The hook therefore also screens prompts for denied paths (heuristic) and rejects the repo root, outside-repo paths and `skip_permissions`.
2. **Headless agy is read-only by default.** Any tool needing the `command` permission (directory listing, grep, shell) is auto-denied and the call returns "no output produced". File reads by explicit path work. Briefs must name files explicitly.
3. **Writes need `--dangerously-skip-permissions`.** The MCP server refuses `skip_permissions` unless started with `AGY_BRIDGE_ALLOW_SKIP_PERMISSIONS=1`, and the hook denies it as well. So through the bridge Antigravity cannot apply a diff. D-3 (Antigravity applies its own diff) is therefore met by keeping implementation in the Antigravity session, and the bridge is advisory and read-only.
4. **Interface differs from the card.** The bridge tool takes `add_dir` (list), `workspace` (`auto`/`none`), `skip_permissions`; there is no `mode`. Review calls are marked by a `[REVIEW]` prompt prefix instead.
