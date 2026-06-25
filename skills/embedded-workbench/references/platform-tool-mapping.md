# Platform Tool Mapping

This plugin's skills and agents are written with Claude Code tool names. This reference maps each tool to equivalents on other platforms. When an agent prompt says "use `Read`" but you are on Codex CLI, use the mapped tool instead.

## Core File Tools

| Claude Code | Codex CLI | Cursor | Kimi CLI | OpenCode | ZCode | Copilot CLI |
|-------------|-----------|--------|----------|----------|-------|-------------|
| `Read` | `read_file` | `read_file` | `read_file` | `read` | `read_file` | `read_file` |
| `Write` | `write_file` | `write_to_file` | `write_file` | `write` | `write_file` | `write_file` |
| `Edit` | `edit_file` | `replace_in_file` | `edit_file` | `edit` | `edit_file` | `edit_file` |
| `Glob` | `search_file` | `search_file` | `glob` | `glob` | `search_file` | `search_file` |
| `Grep` | `search_content` | `search_content` | `grep` | `grep` | `search_content` | `search_content` |
| `Bash` | `run_shell` | `execute_command` | `execute_command` | `terminal` | `run_shell` | `run_command` |

## Agent & Skill Tools

| Claude Code | Codex CLI | Cursor | Kimi CLI | OpenCode | ZCode | Copilot CLI |
|-------------|-----------|--------|----------|----------|-------|-------------|
| `Skill("name")` | `$name` (auto) | `use_skill` | `/skill:name` | `$name` | `$name` | `skill("name")` |
| `Agent` | `task` | `task` | `agent` | `task` | `agent` | `task` |

## Web Tools

| Claude Code | Codex CLI | Cursor | Kimi CLI | OpenCode | ZCode | Copilot CLI |
|-------------|-----------|--------|----------|----------|-------|-------------|
| `WebFetch` | `web_fetch` | `web_fetch` | `web_search` | `fetch` | `web_fetch` | `web_fetch` |
| `WebSearch` | `web_search` | `web_search` | `web_search` | `search` | `web_search` | `web_search` |

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

- `run_command` requires explicit approval for destructive operations.
- Skill invocation differs from Claude Code; check Copilot CLI docs.
- Copilot CLI 1.0.11+ supports Agent Skills.

## Sub-Agent Platform Equivalents

This plugin defines 4 sub-agents. On platforms without an `Agent` tool:

| Claude Code Agent | Alternative Approach |
|-------------------|---------------------|
| `architecture-steward` | Ask user to run a separate session with planning prompt |
| `design-reviewer` | Load `fact-verification` skill in current session; manually verify claims |
| `execution-worker` | Sequential implementation in current session with approval gates |
| `quality-coordinator` | Self-review checklist from `references/final-qc.md` template |

## When to Load This Reference

Load this when:

- The session is NOT running on Claude Code (check environment: `$CLAUDE_PLUGIN_ROOT`, `$CODEX_CLI`, `$CURSOR_PLUGIN_ROOT`, etc.)
- An agent prompt references a tool you don't recognize
- You need to translate a skill or workflow instruction to your platform

**Rule**: Always use your platform's native tool names. The tool instructions in skills are Claude Code conventions — translate them, don't copy them verbatim.
