# Packaging the Antigravity bridge: plugin, cloud sessions, single source

Analysis for the PO, 2026-11-05. No change has been made on the strength of it. Sources: the Claude Code documentation pages on plugins, plugin marketplaces, the plugin reference, MCP, managed MCP, Claude Code on the web, cloud environments and settings (code.claude.com/docs). Two fetches returned model summaries of truncated pages; such points are marked **[unverified]** and should be checked before anyone relies on them.

## Short answers

1. **Standardise as a plugin**, in its own repository that is also a marketplace. A plugin bundles exactly what this bridge consists of: an MCP server definition, hooks, subagents, skills and scripts.
2. **Running agy in a Claude Code cloud session is not feasible today.** The CLI needs a Google browser sign-in, which the docs call unsupported in cloud sessions, and the plugin itself is not installed automatically there. The workable pattern stays as it is now: cloud sessions produce cards, PRs and review requests; the PO's machine runs agy.
3. **One source of truth:** a git repository holding `.claude-plugin/marketplace.json`, versioned by tags, registered in each project through `extraKnownMarketplaces` and `enabledPlugins`, with auto-update switched on per marketplace.

## 1. Plugin or tool?

A plugin is "a directory of skills, agents, hooks, MCP servers, or other components that Claude Code installs and loads as one unit". Layout (plugin reference): manifest `.claude-plugin/plugin.json` (only `name` is required), `skills/`, `agents/`, `hooks/hooks.json`, `.mcp.json` at the plugin root, `bin/` for executables. Scripts are addressed with `${CLAUDE_PLUGIN_ROOT}` (changes on every update, so no state there) and `${CLAUDE_PLUGIN_DATA}` (kept across updates). Stdio MCP servers receive these as environment variables.

Mapping of today's pieces:

| Today (CL-11, CL-12) | Plugin component |
|---|---|
| `.mcp.json` entry for the bridge | plugin `.mcp.json` (optional, see below) |
| `scripts/agy-guard.mjs` PreToolUse hook | `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}/scripts/agy-guard.mjs` |
| `scripts/agy-job.mjs` runner | `scripts/` in the plugin; started from a skill or slash command |
| `smr-brief-writer`, `smr-delegation-logger`, `smr-qa-reviewer` | `agents/` (the SMR-specific ones stay in the SMR repository) |
| routing table and brief rules in `CLAUDE.md` | a skill, so every project gets the same instructions |

What must change before packaging:

- **Policy out of code.** The allow/deny lists are Secure Mail Ring paths. The plugin ships the mechanism; each repository supplies a policy file (for example `.claude/agy-policy.json`).
- **Fewer moving parts.** CL-12 showed `agy --output-format stream-json` works over plain pipes, so the runner needs no Python and no third-party package. The community MCP server (`agy-headless-bridge`, Python, pywinpty) becomes optional. Dropping it removes a supply-chain dependency.
- **Containment first.** The T7 results (see the T7 report) show the file tools of agy are not confined by `add_dir`. A plugin that spreads this setup should ship the mitigation, not the assumption "bridge calls are read-only".

Alternatives considered: a plain npm package or git submodule gives scripts but no hooks, agents or skills wiring; a user-level `~/.claude` setup is not shareable and not versioned. Plugin is the only option that covers all components with versioned updates.

## 2. Cloud sessions

What the docs state (cloud sessions, one repository, outside a project's threads):

- The repository's `.mcp.json` is part of the clone and its servers load, without an approval prompt (`claude -p`, SDK and cloud sessions cannot show one).
- The repository's `.claude/settings.json` is read, including hooks and permission rules.
- **Plugins are not installed automatically.** "A cloud session doesn't install the plugins a repository turns on under `enabledPlugins`, including ones from the marketplaces it lists under `extraKnownMarketplaces`."
- In a project's cloud threads (like this project's threads) repository hooks, permission rules and `env` are not applied.
- claude.ai connectors work and bypass the network allowlist (traffic goes through Anthropic).

What is not documented, so unknown: whether stdio or remote HTTP servers that you configure yourself run in cloud sessions beyond the `.mcp.json` line above **[unverified]**.

Why agy itself cannot be the worker there:

- Sign-in: the CLI uses a Google browser OAuth login. The docs list "interactive auth like AWS SSO" as unsupported ("requires browser-based login that can't run in a cloud session") and describe no persistence of CLI credentials across VM pauses.
- Network: default access is "Trusted" (allowlist). Adding hosts needs a Custom environment; there is no organisation-wide allowlist.
- Policy: `AGENTS.md` section 10 already states the bridge runs only on the PO's machine; a cloud container holding a personal Google token would also widen the trust boundary.

Realistic options, in order of preference:

1. **Keep agy on the PO's machine** (current design). Cloud sessions request, the local session executes and logs. Nothing new to build.
2. **A second-opinion reviewer in the cloud that is not agy:** call a model API with a key stored as a network secret (the docs describe secrets as injected by Anthropic's agent proxy for hosts you list; the container never sees the key) and an allowed host. It loses agy's agent features but fits advisory review. Needs a cost and data-handling decision (the core would leave for that provider).
3. **Expose the PO's runner as a remote MCP server** through a connector. Not recommended: it publishes a command-execution surface of a personal machine.

## 3. A single source for every environment

Structure:

- Repository `agy-bridge-plugin` (name open). Root `.claude-plugin/marketplace.json` (`name`, `owner`, `plugins[]` each with `name` and `source`) and the plugin under `plugins/agy-bridge/`, so a relative `source` lets the marketplace copy carry the plugin.
- Releases: `claude plugin validate`, then a tag. Consumers follow a `stable` ref (`marketplace add owner/repo#stable`) that moves only after QA, mirroring the project's maker, checker, approver flow. Set `version` in one place only (plugin.json or the marketplace entry), and bump it on each release, or omit it to track commits.
- Consumers: each repository's `.claude/settings.json` registers it with `extraKnownMarketplaces` (`{ "source": "github", "repo": "..." }`, optional `"autoUpdate": true`) and turns it on with `enabledPlugins` (`"agy-bridge@<marketplace>": true`). This applies only in a folder the person has trusted. A plugin listed by relative path loads from the marketplace copy; one that points at an external source needs a one-time `claude plugin install <name>@<marketplace> --scope project`.
- Updates: background auto-update is off by default and cannot be switched on from `marketplace.json`; a person turns it on per marketplace in `/plugin`, or an administrator sets `autoUpdate` on a managed entry. Without it, `/plugin marketplace update <name>` and `claude plugin update <plugin>@<marketplace>`.
- Fleet-wide forcing exists through managed settings (server-managed settings in the claude.ai admin console, MDM, or a managed settings file). It needs an organisation plan; the PO is on a personal plan, so it is not available and the repository settings are the mechanism.
- Cloud environments are the exception: plugins are not installed there, so anything a cloud session must see has to live in the repository files (`CLAUDE.md`, `.claude/settings.json`, `.mcp.json`, `.claude/agents/`). See "PO answers" below for how the single source reaches them.

## PO answers (2026-11-05) and what they change

The PO wants every environment, including cloud sessions, on a personal plan. Consequences:

- **No managed settings.** Fleet-wide forcing needs an organisation plan, so each machine and each repository opts in itself (`extraKnownMarketplaces` and `enabledPlugins` in the repository's `.claude/settings.json`, or in the user's `~/.claude/settings.json` for personal tooling; user scope is not confirmed by the pages read **[unverified]**). Auto-update is switched on per marketplace by hand in `/plugin`.
- **Cloud sessions cannot consume the plugin** (not installed automatically, and agy cannot run there). Cloud still needs the *workflow* half of the bridge: the routing rules, the brief writer, the QA reviewer, the delegation log convention. Those must reach the cloud through the repository files.

So the single source feeds two kinds of consumer:

| Part | Content | Consumer | How it updates |
|---|---|---|---|
| `agy-bridge` plugin (local only) | guard hook, job runner, optional MCP entry, runner skill | Windows machines of the PO | marketplace, auto-update on, tag `stable` |
| `workflow` content (everywhere) | generic subagents (brief writer, QA reviewer, logger), a routing skill, the `CLAUDE.md` async section | local sessions and cloud sessions | vendored into each repository's `.claude/` by a sync script that opens a PR from the single source |

The sync keeps the maker, checker, approver rule: the source repository releases a tag; a script (run by hand or by a scheduled GitHub Action) copies the `workflow` files into a consumer repository and opens a PR; Claude checks it; the PO merges. The consumer repository stays self-contained for cloud sessions, which only see the clone.

Alternatives for cloud, none confirmed by the pages read:

- A setup script or a SessionStart hook that runs `claude plugin marketplace add` and `claude plugin install` inside the container. Hooks of a repository run only in single-repository sessions outside a project's threads, and it is not documented that a plugin installed this way loads into the same session **[unverified]**.
- A git submodule of the source repository: the clone then carries the files, but updates need a pointer bump commit, which is the same PR flow without the copy step.

## Suggested order (needs PO approval, nothing started)

1. Finish T7 and decide the containment design: plan mode for read-only (verified), and for any write mode a staging copy or an OS boundary.
2. Make the guard and runner policy-driven; drop the Python bridge from the default path.
3. Create the source repository and marketplace; move the scripts, the hook and the generic subagents; split `agy-bridge` from `workflow`.
4. Write the sync script; run it once against this repository; delete the local copies that the plugin and the vendored files replace.
5. Test the cloud path with one throwaway session before relying on it.

## Remaining question for the PO

- Which repositories besides Secure Mail Ring will consume it? One repository does not justify the sync machinery; a second one does.
