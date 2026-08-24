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

Install the bundle from the repository root (the root `package.json` declares `dsh.bundle`):

```bash
# from GitHub (source of truth)
npx -p @deepseek-ai/dsh dsh plugin --profile web add "github:AmethystLuna/embedded-workbench"
# or from npm (published as dsh-embedded-workbench)
npx -p @deepseek-ai/dsh dsh plugin --profile web add dsh-embedded-workbench
```

This installs under the package name `dsh-embedded-workbench`. If you manage the profile's `package.json` manually, use `dsh-embedded-workbench` for both the dependency key and the `dsh.profile.bundles` entry.

Restart the target profile. This mounts a native cordis plugin that folds the gate text (1% Rule / Red Flags / Plan Verification Gate) into the first model step — the dsh-native counterpart of the Claude Code `SessionStart` hook — and registers the 7 skills in the package's `skills/` directory into dsh's `ctx.skills` registry via the standard filesystem provider, so they appear in the session skill catalog with no manual copy step.

To change the gate text or disable injection, override the row by id in your profile's `cordis.patch.yml` (the row's `config` is replaced wholesale, not deep-merged):

```yaml
- insert:
    - id: embedded-workbench
      name: 'dsh-embedded-workbench'
      config:
        enabled: true
        gateContent: |
          <EXTREMELY_IMPORTANT>
          Your own gate text...
          </EXTREMELY_IMPORTANT>
```

## Verify

- `dsh --profile <scratch> --dump-config` shows the `embedded-workbench` row with `enabled: true` (create a scratch profile with `dsh plugin --profile <scratch> add ...` first).
- Start a session and check the gate text appears in the model context of the first step.
- `cordis_inspect_list` shows the `embedded-workbench` provider; `cordis_inspect_query` with method `status` returns `enabled: true`.
- Ask in a `dsh` session: "What embedded firmware skills do you have available?"

## Notes

- Skill frontmatter already matches the DSH expectations: `name` is kebab-case and matches the directory name; `description` is present. The policy keys `disable-model-invocation` / `user-invocable` are omitted, which defaults to model- AND user-invocable — the intended behavior.
- DSH is in v0.1 developer preview; breaking changes are expected. Pin your `dsh` version.
- DSH has no plugin marketplace for this repo — install via npm (`dsh-embedded-workbench`) or manually.
- The first-model-step gate injection is provided natively by the root bundle (Option D). The 4 custom agents (`architecture-steward`, `design-reviewer`, `execution-worker`, `quality-coordinator`) are intentionally **not** ported — dsh's native subagent tooling covers parallel multi-agent work, and the main model takes the steward/reviewer roles directly.
- The Plan Verification Gate references the `logicprobe` skill — a **separate plugin** (same author). Install it too; without it the gate degrades to manual confirmation mode.
- **Gate injection semantics**: the gate is appended to the first model step that runs via `agent/pre-step`, once per session, guarded by the session's durable history. This is resilient to blank-session preset switches that clear the agent inbox before the first step; anchored/bootstrap presets may strip first-step Gate messages and the plugin re-injects after promotion. The gate text is the dsh-native adaptation of `hooks/session-start-content.md` — behavior rules synced, presentation adapted to the dsh skill catalog (no roster table, no install instructions); review it per deployment and override via `gateContent`.

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
