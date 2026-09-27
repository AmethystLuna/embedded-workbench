# Platform Tool Mapping

This plugin's skills and agents are written with Claude Code tool names. This reference maps each tool to equivalents on the other supported platforms — Codex CLI, Cursor, Kimi CLI, OpenCode, ZCode, Copilot CLI, and DeepSeek Harness (dsh). When an agent prompt says "use `Read`" but you are on Codex CLI, use the mapped tool instead.

## Core File Tools

| Claude Code | Codex CLI | Cursor | Kimi CLI | OpenCode | ZCode | Copilot CLI | DeepSeek Harness (dsh) |
|-------------|-----------|--------|----------|----------|-------|-------------|------------------------|
| `Read` | `read_file` | `read_file` | `read_file` | `read` | `read_file` | `view` | `read` |
| `Write` | `write_file` | `write_to_file` | `write_file` | `write` | `write_file` | `create` | `write` |
| `Edit` | `edit_file` | `replace_in_file` | `edit_file` | `edit` | `edit_file` | `edit` | `edit` |
| `Glob` | `search_file` | `search_file` | `glob` | `glob` | `search_file` | `glob` | `glob` |
| `Grep` | `search_content` | `search_content` | `grep` | `grep` | `search_content` | `grep` | `grep` |
| `Bash` | `run_shell` | `execute_command` | `execute_command` | `terminal` | `run_shell` | `bash` | `pwsh` / `bash` |

## Agent & Skill Tools

| Claude Code | Codex CLI | Cursor | Kimi CLI | OpenCode | ZCode | Copilot CLI | DeepSeek Harness (dsh) |
|-------------|-----------|--------|----------|----------|-------|-------------|------------------------|
| `Skill("name")` | `$name` (auto) | `use_skill` | `/skill:name` | `$name` | `$name` | `skill` tool, or `/skill-name` | `skill` tool (`name: "..."`) |
| `Agent` | `task` | `task` | `agent` | `task` | `agent` | `task` (`agent_type`) | `subagent` / `subagent_fork` |

## Web Tools

| Claude Code | Codex CLI | Cursor | Kimi CLI | OpenCode | ZCode | Copilot CLI | DeepSeek Harness (dsh) |
|-------------|-----------|--------|----------|----------|-------|-------------|------------------------|
| `WebFetch` | `web_fetch` | `web_fetch` | `web_search` | `fetch` | `web_fetch` | `web_fetch` | `web_fetch` |
| `WebSearch` | `web_search` | `web_search` | `web_search` | `search` | `web_search` | — (no tool) | `web_search` |

## Platform-Specific Notes

### Codex CLI

- Skills auto-load. Use `$skill-name` to invoke explicitly.
- `skill("name")` is the explicit Skill tool (equivalent to Claude Code's `Skill`).
- Tool names are snake_case and descriptive.

### Cursor

- `execute_command` runs in an integrated terminal.
- Cursor 2.5+ supports Agent Skills natively.
- Plugin auto-discovers skills from standard paths.

### Kimi CLI

- Skill invocation: `/skill:<name>` (slash command).
- Kimi auto-discovers from `.claude/skills/` paths.
- Agent system differs from Claude Code's `Agent` tool.

### OpenCode

- `$skill-name` or `skill("name")` for skill invocation.
- Skills auto-discover from `.claude/skills/` and `.codex/skills/`.
- Plugin installed via `opencode.json` `plugin` array.

### ZCode (Z.AI)

- ZCode 3.0+ follows Agent Skills standard.
- Skills invoked with `$skill-name`.
- No plugin marketplace — manual copy to `.zcode/skills/`.
- Auto-discovers from `.claude/skills/` and `.codex/skills/`.

### Copilot CLI (GitHub Copilot)

- Copilot CLI has a plugin system: a `plugin.json` manifest plus `agents/NAME.agent.md`, `skills/NAME/SKILL.md`, hooks, and MCP servers, distributed through marketplaces (`copilot-plugins`, `awesome-copilot`). Install with `copilot plugin install NAME@MARKETPLACE`, or register this repository with `copilot plugin marketplace add AmethystLuna/embedded-workbench`.
- **This repository already works as a Copilot plugin**: Copilot's legacy manifest lookup checks `.plugin/plugin.json`, `plugin.json`, `.github/plugin/plugin.json`, then `.claude-plugin/plugin.json` — and it also reads `marketplace.json` from `.claude-plugin/`. Both files already exist here.
- Skills follow the Agent Skills open standard, so `skills/NAME/SKILL.md` loads as-is. Invoke one with `/skill-name` in a prompt, e.g. `Use the /debug-methodology skill to ...`; inspect them with `/skills list` or `copilot skill list`.
- Tool names: `view` (read), `create` (write), `edit`, `glob`, `grep`, `bash`, `web_fetch`, `task`, `skill`. The edit tool is `str_replace_editor` under the hood, with `view`/`create`/`edit` as its aliases.
- There is **no** `web_search` tool — use `web_fetch` against a search URL.
- `task` requires an `agent_type` of `explore`, `task`, `general-purpose`, or `code-review`. `explore` is read-only and the cheapest; prefer it for searches.
- Sub-agent status comes from `read_agent` / `list_agents`; async shell sessions use `bash` with `mode: "async"` plus `read_bash` / `write_bash` / `stop_bash` / `list_bash`.
- Agents in this plugin are **not** loaded by Copilot: it requires `agents/NAME.agent.md`, and this repository ships `agents/NAME.md`.

### DeepSeek Harness (dsh)

- dsh is the one platform this plugin ships a **native bundle** for (root `package.json` declares `dsh.bundle`), so no skill-copy step is needed: `dsh plugin --profile <name> add dsh-embedded-workbench`.
- Tool names are lowercase: `read`, `write`, `edit`, `glob`, `grep`. Shell access is `pwsh` on Windows hosts and `bash` elsewhere.
- Skills load through the `skill` tool by name — there is no `Skill(...)` call syntax.
- Plan mode is the native `exit_plan_mode` tool, not `ExitPlanMode`.
- The 4 Claude Code sub-agents are intentionally **not** ported: use the native sub-agent tools for parallel work, and take the steward/reviewer roles directly.
- `subagent` starts a **fresh** context and returns only its result — reach for it when the detail can be discarded (read-only discovery, sweeping logs, running a suite). `subagent_fork` is **seeded with this conversation** — reach for it when the sub-task needs context you already built, instead of rebuilding that context inside a prompt.
- `Agent(subagent_type: "Explore")` has no separate equivalent — use `glob` / `grep` directly, or dispatch a read-only `subagent`.
- **Context-budget markers** you can actually see (no token meter is exposed to the model): a tool result rewritten with `[... tool result middle pruned ...]`, a spill notice naming the omitted bytes and the complete-result path, and the compaction checkpoint preamble (`This is an automatically generated checkpoint condensing an earlier span…`). Treat any of them as "stop pulling content in whole" — switch to file references, or delegate the reading.
- Install, verify, and config-override details live in `.dsh/INSTALL.md` at the repository root.

## Context Budget Interfaces

What each harness actually exposes to the **model** about its context budget, checked 2026-09-25 against vendor documentation (and, for Codex CLI, the `openai/codex` source). "User-only" means the signal exists but never reaches the model. `UNVERIFIED` means the vendor does not document it — do not invent a marker string for that cell.

| Harness | Model sees a token/percent readout? | Compaction — trigger and what the model receives | Oversized tool output | Sub-agent context |
| --- | --- | --- | --- | --- |
| Claude Code | No — `/context` and the status line are user-facing (the status line even exposes `used_percentage`, but to the terminal, not the model) | Automatic near the limit (`/autocompact <100K–1M>`). Older tool outputs are cleared first, then history is summarized; afterwards an oversized re-read returns as a `Referenced file` path instead of content, and invoked skill bodies are re-injected capped at 5,000 tokens each / 25,000 total | Bash success output past ~30,000 characters becomes a file path plus a preview of up to 2,000 characters (a failure is truncated in place with **no** path); hook `additionalContext` over 10,000 characters is saved to a file and the model gets a preview plus the path; Read adds a `PARTIAL view` notice and Glob flags a 100-file cap | Fresh isolated window; **fork mode** (on by default in interactive sessions, off under `-p`/SDK) inherits the parent conversation. Note a skill's `context: fork` is *not* a conversation fork |
| Codex CLI | Yes, but feature-gated: a `get_context_remaining` tool (feature `token_budget`, **off by default**) answers "You have {N} tokens left in this context window", and a reminder is injected once remaining drops below the threshold. `/status` percentages are user-only | Default 90% of the window, hard cap 95%. The model receives the summary behind a fixed handoff preamble ("Another language model started to solve this problem…") | `truncation_policy` defaults to bytes/10000: the model sees `Warning: truncated output (original token count: N)` and `…N tokens truncated…`. Spill-to-file exists only for hooks (`Full hook output saved to: <path>`) | `spawn_agent` `fork_turns`: `"none"` / `"all"` / a turn count — **the default is `"all"`** |
| Copilot CLI | No — `/context`, `/usage`, and `footer.showContextWindow` are user-only | ~80% of the window in the background (defers to ~90% when static context already uses ≥75%), pausing at ~95%. The model gets the summary plus preserved user instructions and plan/todo state; each compaction writes a numbered checkpoint (`/session checkpoints`) | **Over 20 KiB** is saved to a temporary file and the model gets the path plus a preview (`COPILOT_LARGE_OUTPUT_THRESHOLD_BYTES`) | Fresh window; `contextTier: "inherit"` inherits the parent's tier. Repository custom instructions are **not** inherited unless the agent sets `include-custom-instructions: true` |
| Cursor | Nothing documented — the context ring and breakdown tray are UI | Automatic once the window is full; `/summarize` (alias `/compress`). The injected summary text is not published | Not documented (UNVERIFIED) | Fresh window only; `model: inherit` inherits the **model**, not the conversation |
| OpenCode | No | `compaction.auto` is on, keeping ~15,000 recent tokens (`keep.tokens`) with `buffer` at 10% of the limit. The model sees the summary **as past conversation** — there is no distinct notice, and later compactions update the same summary. Native provider compaction substitutes an opaque encrypted item | Long tool output is shortened beside the summary; no marker string documented | UNVERIFIED |
| Kimi CLI | No — `/usage` is a user command | Automatic compression as the conversation approaches the window limit, plus `/compact [hint]`. `/undo` cannot cross a compaction | Not documented (UNVERIFIED) | Isolated context per sub-agent (its own event stream); built-ins `coder`, `explore`, `plan`. `/btw` runs in a **forked** sub-agent that sees the conversation |
| ZCode | No — the usage-stats panel shows the context composition as UI | `/compact` is user-initiated; automatic compaction is not documented | Not documented (UNVERIFIED) | UNVERIFIED |
| DeepSeek Harness (dsh) | No — `ctx.tokenMeter` deliberately adds no model-visible surface | At `floor(min(W × 0.8, W − O − 65536))`. The model receives the checkpoint preamble plus `<compacted-summary>`; `/compact` is a user command | `[... tool result middle pruned ...]` for results over 8,192 code points (4,096 head / 1,024 tail) once compaction pressure qualifies, plus a spill notice naming the omitted bytes and the complete-result path (12,500 estimated tokens in `dsh-base`) | `subagent` starts fresh; `subagent_fork` is seeded with the conversation so far |

Two consequences worth remembering:

- **A budget readout reaching the model is the exception, not the rule.** Only Codex documents one, and it is off by default. Everywhere else, act on the truncation, spill, or compaction notice your harness actually shows.
- **With no signal, ask the user instead of guessing.** Say what you are about to consume, that this harness gives you no budget readout, and the options with their costs, then do what they choose — falling back to the reversible option only when no one can answer.

## Sub-Agent Platform Equivalents

This plugin defines 4 sub-agents. On platforms without an `Agent` tool (including DeepSeek Harness):

| Claude Code Agent | Alternative Approach |
|-------------------|---------------------|
| `architecture-steward` | Ask user to run a separate session with planning prompt |
| `design-reviewer` | Load `logicprobe` skill (standalone plugin; built-in `fact-check` fallback if logicprobe is not installed); manually verify claims |
| `execution-worker` | Sequential implementation in current session with approval gates |
| `quality-coordinator` | Self-review checklist from `references/final-qc.md` template |

## When to Load This Reference

Load this when:

- The session is NOT running on Claude Code (check environment: `$CLAUDE_PLUGIN_ROOT`, `$CODEX_CLI`, `$CURSOR_PLUGIN_ROOT`, etc.; a dsh session runs under `$DSH_HOME` and sees none of those)
- An agent prompt references a tool you don't recognize
- You need to translate a skill or workflow instruction to your platform

**Rule**: Always use your platform's native tool names. The tool instructions in skills are Claude Code conventions — translate them, don't copy them verbatim.
