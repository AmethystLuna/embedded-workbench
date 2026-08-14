# Installing Embedded Workbench for DeepSeek Harness (dsh)

DeepSeek Harness (`dsh`) discovers skills via the Agent Skills open standard (agentskills.io) — the same `skill-name/SKILL.md` + frontmatter layout this plugin already uses. All 7 skills are discovered as-is; no content changes required.

## Install

### Option A — user-level, cross-harness (recommended)

Copy the skills into `~/.agents/skills/` — DSH discovery root rank 500, and a shared directory that other Agent-Skills-standard harnesses also read:

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git
mkdir -p ~/.agents/skills
cp -r embedded-workbench/skills/* ~/.agents/skills/
```

### Option B — project-level

Copy the skills into your project's `.dsh/skills/` (DSH discovery root rank 100 — highest priority, scoped to that project only):

```bash
mkdir -p .dsh/skills
cp -r embedded-workbench/skills/* .dsh/skills/
```

### Option C — zero-copy (advanced)

If your `dsh` configuration supports `customSkillDirs` (rank 300), point it at this repository's `skills/` directory instead of copying. See the dsh configuration docs for the exact key placement.

### Option D — native plugin (session-start gate injection)

Install the bundle from [packages/dsh-plugin](../packages/dsh-plugin/README.md):

```bash
npx -p @deepseek-ai/dsh dsh plugin --profile web add "github:AmethystLuna/embedded-workbench"
```

This mounts a native cordis plugin that folds the session-start gate text (1% Rule / Red Flags / Plan Verification Gate) into the first model step — the dsh-native counterpart of the Claude Code `SessionStart` hook.

## Verify

Ask in a `dsh` session: "What embedded firmware skills do you have available?"

## Notes

- Skill frontmatter already matches the DSH expectations: `name` is kebab-case and matches the directory name; `description` is present. The policy keys `disable-model-invocation` / `user-invocable` are omitted, which defaults to model- AND user-invocable — the intended behavior.
- DSH is in v0.1 developer preview; breaking changes are expected. Pin your `dsh` version.
- DSH has no plugin marketplace for this repo — manual install only.
- The session-start gate injection is provided natively by the `embedded-workbench-dsh` bundle (Option D). The 4 custom agents (`architecture-steward`, `design-reviewer`, `execution-worker`, `quality-coordinator`) are intentionally **not** ported — dsh's native subagent tooling covers parallel multi-agent work, and the main model takes the steward/reviewer roles directly.

## Tool Mapping

When skills reference Claude Code tools:

| Skill text | DeepSeek Harness equivalent |
|---|---|
| `Skill("name")` | Skills are model-invocable by default; the model loads them through the skills catalog (`ctx.skills`) |
| `Read` / `Write` / `Edit` / `Bash` | Native dsh tools (`ctx.tools` registry) |
| `Agent("architecture-steward")` etc. | Not ported — use dsh's native `subagent` / `subagent_fork` tools for parallel work; the main model takes the role directly |
| `ExitPlanMode` / plan-mode gates | dsh-native: `@deepseek-ai/dsh-plan-mode` (`exit_plan_mode` tool); the bundle's gate text carries the Plan Verification Gate |

## Getting Help

- Issues: [https://github.com/AmethystLuna/embedded-workbench/issues](https://github.com/AmethystLuna/embedded-workbench/issues)
- Docs: [https://github.com/AmethystLuna/embedded-workbench](https://github.com/AmethystLuna/embedded-workbench)
