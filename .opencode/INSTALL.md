# Installing Embedded Workbench for OpenCode

## Installation

Add to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["embedded-workbench@git+https://github.com/AmethystLuna/embedded-workbench.git"]
}
```

Or pin a specific version:

```json
{
  "plugin": ["embedded-workbench@git+https://github.com/AmethystLuna/embedded-workbench.git#v0.3.0"]
}
```

Restart OpenCode.

Verify: ask "What embedded firmware skills do you have available?"

## Manual Install

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.config/opencode/plugins/embedded-workbench
```

Skills are auto-discovered from the standard `.claude/skills/` and `.codex/skills/` paths within the plugin directory.

## Tool Mapping

When skills reference Claude Code tools:
- `Skill("name")` → OpenCode's native `skill` tool
- `Agent()` / `Task` → `@mention` syntax
- `Write`/`Edit`/`Read`/`Bash` → OpenCode native tools

## Getting Help

- Issues: https://github.com/AmethystLuna/embedded-workbench/issues
- Docs: https://github.com/AmethystLuna/embedded-workbench
