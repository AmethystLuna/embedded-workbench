# Installing Embedded Workbench for ZCode (Z.AI)

ZCode 3.0+ follows the Agent Skills open standard. Skills are auto-discovered from `.zcode/skills/`.

## Install

```bash
# Clone the repo
git clone https://github.com/AmethystLuna/embedded-workbench.git

# Symlink skills into ZCode discovery path (project-level)
mkdir -p .zcode/skills
cp -r embedded-workbench/skills/* .zcode/skills/
```

Or use `specify init` with spec-kit integration:

```bash
specify init --integration zcode
```

Verify: `$debug-methodology` in ZCode chat.

## Notes

- ZCode has no plugin marketplace — manual install only
- ZCode does not support custom agents — only skills are usable
- Skills use the same `$skill-name` invocation as Codex
- ZCode auto-discovers skills from `.zcode/skills/`, `.claude/skills/`, and `.codex/skills/`

## Tool Mapping

When skills reference Claude Code tools:
- `Skill("name")` → `$skill-name`
- `Read`/`Write`/`Edit`/`Bash` → ZCode native tools
- `Agent()` / `Task` → ZCode subagent system
