# Installing Embedded Workbench for DeepSeek Harness (dsh)

DeepSeek Harness (`dsh`) discovers skills through the Agent Skills open standard (agentskills.io). The layout is the same `skill-name/SKILL.md` plus frontmatter that this plugin already uses.

The recommended install is the native plugin bundle. It registers all 8 skills and folds the gate into the first model step in one step. The skill-copy options below remain for hosts that do not use the dsh plugin manager.

## Install

### Option A — native plugin bundle (recommended)

Install the bundle from the repository root. The root `package.json` declares `dsh.bundle`:

```bash
# from npm (published as dsh-embedded-workbench)
dsh plugin --profile web add dsh-embedded-workbench
# or from GitHub (source of truth)
dsh plugin --profile web add "github:AmethystLuna/embedded-workbench"
# when dsh is not installed globally
npx -p @deepseek-ai/dsh dsh plugin --profile web add dsh-embedded-workbench
```

This installs under the package name `dsh-embedded-workbench`. If you manage the profile's `package.json` by hand, use that same name for both the dependency key and the `dsh.profile.bundles` entry.

That bare-name install has one gotcha on **pnpm 11 and newer**. pnpm holds back versions published less than a day ago (`minimumReleaseAge`, default 1440 minutes). Its built-in default is non-strict, so it **silently resolves to an older version instead of failing**. For roughly 24 hours after a release, `add dsh-embedded-workbench` therefore installs the previous version, and the profile looks like the release never happened. Pin the version to get it immediately:

```bash
dsh plugin --profile web add dsh-embedded-workbench@<version>   # e.g. @0.9.1
```

Pinning also makes pnpm record a `minimumReleaseAgeExclude` entry for that version in the profile's `pnpm-workspace.yaml`. That entry is pnpm's documented escape hatch.

Restart the target profile. The bundle mounts a native cordis plugin, and that plugin does two things.

1. It registers the 8 skills from the package's `skills/` directory into dsh's `ctx.skills` registry, through the standard filesystem provider. The skills then appear in the session skill catalog, with no manual copy step.
2. It folds a **trimmed** gate into the first model step. The gate carries the Plan Verification Gate plus the context-budget rule, about 400 tokens in total. This is the dsh counterpart of the Claude Code `SessionStart` hook. The 1% Rule and the Red Flags table deliberately stay out of that payload; see "Design trade-offs and feedback" in the README. Set `enabled: false` to drop the injection entirely.

To disable the gate, or to change its text, override the row by id in your profile's `cordis.patch.yml`. The row's `config` is replaced wholesale, not deep-merged:

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

### Option B — user-level, cross-harness

Copy the skills into `~/.agents/skills/`. That is DSH discovery root rank 500, and other harnesses that follow the Agent Skills standard read it too:

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git
mkdir -p ~/.agents/skills
cp -r embedded-workbench/skills/* ~/.agents/skills/
```

### Option C — project-level

Copy the skills into your project's `.dsh/skills/`. That is discovery root rank 100, the highest priority, scoped to that project alone:

```bash
mkdir -p .dsh/skills
cp -r embedded-workbench/skills/* .dsh/skills/
```

### Option D — zero-copy (advanced)

If your `dsh` configuration supports `customSkillDirs` (rank 300), point it at this repository's `skills/` directory instead of copying. See the dsh configuration docs for the exact key placement.

## Verify

- `dsh --profile <scratch> --dump-config` shows the `embedded-workbench` row with `enabled: true`. Create a scratch profile first with `dsh plugin --profile <scratch> add ...`.
- Start a session. The gate text must appear in the model context of the first step.
- `cordis_inspect_list` shows the `embedded-workbench` provider. `cordis_inspect_query` with method `status` returns `enabled: true`, unless you disabled it.
- Ask in a `dsh` session: "What embedded firmware skills do you have available?"

## Notes

- Skill frontmatter already matches the DSH expectations. `name` is kebab-case and matches the directory name, and `description` is present. The policy keys `disable-model-invocation` and `user-invocable` are omitted, which defaults to model- and user-invocable. That is the intended behavior.
- DSH is in v0.1 developer preview, so breaking changes are expected. Pin your `dsh` version.
- This repo has no plugin marketplace. Install the native bundle from npm (`dsh-embedded-workbench`) or from GitHub. The skill-copy options above are fallbacks.
- The first-model-step gate injection comes from the root bundle (Option A). The 4 custom agents (`architecture-steward`, `design-reviewer`, `execution-worker`, `quality-coordinator`) are intentionally **not** ported. dsh's native subagent tooling covers parallel multi-agent work, and the main model takes the steward and reviewer roles directly.
- The Plan Verification Gate prefers the `logicprobe` skill, which is a **separate plugin** by the same author. Install it too with `dsh plugin --profile <name> add dsh-logicprobe`. Without it, the gate falls back to the built-in `fact-check` skill, which verifies claims against the codebase one by one. Only state-machine and behavioral claims then degrade to manual confirmation.
- **Gate injection semantics**: when enabled, which is the default, the gate is appended to the first model step that runs, through `agent/pre-step`. It is appended once per session, guarded by the session's durable history. That makes it resilient to blank-session preset switches, which clear the agent inbox before the first step. Anchored and bootstrap presets may strip first-step gate messages; the plugin re-injects after promotion. The gate text is the dsh-native adaptation of `hooks/session-start-content.md`. The behavior rules are synced, meaning the Plan Verification Gate and the context-budget rule, and the presentation is adapted to the dsh skill catalog, which has no roster table and no install instructions. Review it for your deployment and override it with `gateContent` if needed.

## Tool Mapping

When skills reference Claude Code tools:

| Skill text | DeepSeek Harness equivalent |
|---|---|
| `Skill("name")` | Skills are model-invocable by default; the model loads them through the skills catalog (`ctx.skills`) |
| `Read` / `Write` / `Edit` / `Bash` | Native dsh tools (`ctx.tools` registry) |
| `Agent("architecture-steward")` etc. | Not ported. Use `subagent` (fresh context, returns only the result) for read-only discovery, or `subagent_fork` (seeded with this conversation) when the sub-task needs context you already built. The main model takes the role directly. |
| `ExitPlanMode` / plan-mode gates | dsh-native: `@deepseek-ai/dsh-plan-mode` (`exit_plan_mode` tool); the bundle's gate text carries the Plan Verification Gate |

## Getting Help

- Issues: [https://github.com/AmethystLuna/embedded-workbench/issues](https://github.com/AmethystLuna/embedded-workbench/issues)
- Docs: [https://github.com/AmethystLuna/embedded-workbench](https://github.com/AmethystLuna/embedded-workbench)
