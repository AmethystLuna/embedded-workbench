# Embedded Workbench

<p align="center"><strong>English</strong> · <a href="README.md">中文</a></p>

[![HOL Guard Scanner](https://img.shields.io/badge/HOL%20Guard-passing-00a67e)](https://github.com/hashgraph-online/hol-guard)

Embedded C/C++ firmware toolbox: 4 agents and 8 skills covering FreeRTOS, ISR, NVM storage, Keil MDK (AC5/AC6), ARMCLANG, HardFault triage, state machines, architecture principles, and LVGL patterns.

**Cross-platform**: works with Claude Code, Codex CLI, Cursor, Kimi CLI, OpenCode, ZCode, and DeepSeek Harness (dsh). Built on the [Agent Skills](https://agentskills.io) open standard.

## Components

### Agents (4)

| Agent | Description |
| ------- | ------------- |
| `architecture-steward` | Read-only planning: design packages, module boundaries, slice breakdown |
| `design-reviewer` | Design doc fact-check: verifies claims against codebase |
| `execution-worker` | Plan → approve → implement cycle with build verification |
| `quality-coordinator` | Implementation review: bugs, compliance, closure |

### Skills (8)

| Skill | Description |
| ------- | ------------- |
| `embedded-workbench` | Bootstrap: workflows, policies, sub-agent mapping, proactive suggestions, platform tool mapping, document templates |
| `debug-methodology` | 8 iron rules, fix principles, iterative debugging case study |
| `embedded-firmware-dev` | FreeRTOS, ISR, NVM storage, async lifecycle, boundary analysis, architecture principles, LVGL pitfalls |
| `keil-mdk-build` | UV4 CLI, ARM Compiler 5/6, .map analysis, merge/packaging, build diagnostics |
| `c-cpp-dev` | Code generation, style, memory layout, refactoring for C/C++ |
| `state-machine-design` | State models, retries, timeouts, transition gates, implementation patterns |
| `hardfault-triage` | Processor exception triage: fault registers, stack frames, PC-to-source, root-cause classification |
| `fact-check` | Claim-check fallback: verifies API names, file paths, enum values, counts, and mechanism feasibility against the codebase. Used by the Plan Verification Gate when logicprobe is not installed. |

`logicprobe` (design-doc and plan claim verification) was **split out into its own plugin**. See [Other Plugins Recommended](#other-plugins-recommended). When it is not installed, the Plan Verification Gate falls back to this plugin's built-in `fact-check` skill. Only behavioral and model claims degrade to manual confirmation.

> The skill content is mostly distilled from the author's personal embedded and firmware engineering experience, based on real-world pitfalls and engineering constraints rather than generic model output.

### Deep References

`embedded-firmware-dev`, `debug-methodology`, `state-machine-design`, and `c-cpp-dev` include in-depth reference material and code examples. The material covers 12 architecture principles, embedded patterns (GIF timer safety, state latches, async lifecycle), LVGL pitfalls, a 7-round iterative debugging case study, state machine implementation patterns, and embedded C specifics (volatile MMIO, linker sections, ISR wrappers).

## Installation

### Claude Code install (recommended)

Add the marketplace to **Claude Code**'s `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "embedded-workbench": {
      "source": { "source": "github", "repo": "AmethystLuna/embedded-workbench" }
    }
  }
}
```

Then install from the CLI:

```bash
claude plugin install embedded-workbench@embedded-workbench
```

### Claude Code manual install

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.claude/plugins/dev/embedded-workbench
```

Then enable it in `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "embedded-workbench@dev": true
  }
}
```

## DeepSeek Harness (dsh)

Native dsh support ships as a cordis plugin bundle at the repository root, declared by `dsh.bundle` in the root `package.json`.

The bundle does three things:

1. **Registers the skills.** They follow the Agent Skills open standard and are discovered as-is by dsh's `skill-filesystem` provider. No extra code.
2. **Injects the gate.** The first model step of every agent session receives a **trimmed** first-step gate: the Plan Verification Gate plus the context-budget rule. The `enabled` key controls it, and it is on by default. This is the dsh counterpart of the Claude `SessionStart` hook. For why the 1% Rule and the Red Flags table left the payload, see [Design trade-offs and feedback](#design-trade-offs-and-feedback).
3. **Registers the catalog entry.** The model-visible catalog entry (`cordis_inspect`) is always registered. The 4 custom agents are intentionally not ported, because dsh's native subagent tooling already covers parallel multi-agent work.

Install (native bundle, recommended):

```bash
# from npm (package name: dsh-embedded-workbench)
dsh plugin --profile web add dsh-embedded-workbench
# or from GitHub source
dsh plugin --profile web add "github:AmethystLuna/embedded-workbench"
# when dsh is not installed globally
npx -p @deepseek-ai/dsh dsh plugin --profile web add dsh-embedded-workbench
```

Restart the profile afterwards. `dsh --profile web --dump-config` must show the `id: embedded-workbench` row with `enabled: true`. More options (plain skill copy, project-level install) are in [`.dsh/INSTALL.md`](.dsh/INSTALL.md).

> Package name note: the npm package is `dsh-embedded-workbench`, with no scope. In the web profile's `package.json`, both the dependency key and the `dsh.profile.bundles` entry must use that name. On a mismatch the dsh loader cannot find `node_modules/dsh-embedded-workbench` and the boot fails.

## Usage

Skills load on demand and do not depend on injection:

- Invoke `Skill("embedded-workbench")` for the workflow and engineering policies. It picks a light or full path by risk, and does not force fixed stages.
- Domain skills activate automatically when their `Use when` description matches your task. NOT clauses prevent false triggers, so a formatting-only task does not load `c-cpp-dev`.
- The agent proactively suggests verification, adversarial probing, and parallel subagents when it detects state machines, behavioral claims, or multi-module tasks.
- No manual `CLAUDE.md` configuration is required.

The plugin also folds a **trimmed** gate of about 400 tokens into the first model step. It carries just two things. The first is the Plan Verification Gate. The second is the context-budget rule: never guess a readout you cannot see, and when a large step shows no signal, ask the user to decide. Set `enabled: false` to drop the gate entirely.

## Design trade-offs and feedback

This revision walks back an earlier decision on the evidence. The reasoning is below, and it is open to challenge.

**Background.** We checked the official documentation for all 8 supported harnesses, one by one, and read the source for Codex CLI. One assumption did not survive: **7 of the 8 expose no context-budget readout to the model at all**. Those 7 are Claude Code, Copilot CLI, Cursor, OpenCode, Kimi CLI, ZCode and dsh, and they show token figures only in the user's interface. Only Codex has a `get_context_remaining` tool, and it is off by default. Asking the model to judge "do I have budget to delegate?" therefore had nothing to stand on.

**So we changed two things.**

1. **Cost is now managed by trimming, not by switching injection off.** The first-step gate carries only two things. The first is the **Plan Verification Gate**: verify, or tell the user you did not. The second is a **context-budget rule**: never guess a readout, and when a large step shows no signal, ask the user to decide. The payload went from ~1,400 tokens to ~400, measured at −72% on the Claude side and −58% on the dsh side. It is on by default.
2. **The verification gate stays; the enforcement scaffolding goes.** The 1% Rule and the 9-row Red Flags table left the **injected payload**. They are enforcement, and reported experience shows capable models follow that kind of prompt pressure literally. The result is rigid phases, unnecessary questions, and six or seven agents on a five-line task at 10–15× overhead. See [obra/superpowers#1120](https://github.com/obra/superpowers/issues/1120), [openai/codex#22005](https://github.com/openai/codex/issues/22005) and [#20366](https://github.com/openai/codex/issues/20366). The full table still lives in `Skill("embedded-workbench")`: the discipline is available on request rather than applied to everyone by default. Workflow selection likewise moved from a fixed agent chain to **risk-proportional** paths.

**Deliberately kept.** The Plan Verification Gate is intact. Its fallback chain is logicprobe, then the built-in `fact-check` when logicprobe is not installed, then telling the user if you used neither. Following [Superpowers Lite](https://github.com/BB-84C/superpowers-lite), safety, permission and **verification** gates are the kind to keep. Process ceremony is the kind to scale back.

**Known uncertainty.** These budget interfaces change fast, and we checked once, on 2026-09-25. Every cell a vendor does not document is marked `UNVERIFIED` in [`platform-tool-mapping.md`](skills/embedded-workbench/references/platform-tool-mapping.md), rather than filled in by analogy.

**Disagree?** These are judgement calls, not settled facts, especially "the Red Flags table leaves the payload" and "the gate is on by default". Open an [issue](https://github.com/AmethystLuna/embedded-workbench/issues) with the model tier, harness and counter-example you are working with. We would rather adjust on evidence.

## Codex CLI

This plugin also supports OpenAI Codex CLI. Skills follow the Agent Skills standard and work identically across both platforms. Agents are provided in Codex TOML format under `.codex/agents/`.

### Codex install

```bash
# Add as a marketplace
codex plugin marketplace add AmethystLuna/embedded-workbench

# Install
codex plugin install embedded-workbench
```

Or manually:

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.codex/plugins/embedded-workbench
```

Skills are invoked with `$skill-name` (e.g. `$debug-methodology`), or selected automatically by Codex from the task context.

## Cursor

Cursor 2.5+ has built-in plugin support. Agents in `agents/` are auto-discovered.

### Cursor install

```bash
# Clone to Cursor plugins directory
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.cursor/plugins/embedded-workbench
```

Or install from the Cursor plugin marketplace UI: `/add-plugin AmethystLuna/embedded-workbench`

## Kimi CLI

Kimi CLI discovers skills from `.claude/skills/` paths automatically. The `.kimi-plugin/plugin.json` manifest registers the plugin for Kimi's plugin manager.

### Kimi install

```bash
# Via Kimi plugin manager
/plugins install https://github.com/AmethystLuna/embedded-workbench.git

# Or clone manually
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.kimi/plugins/embedded-workbench
```

Skills are invoked with `/skill:<name>` (e.g. `/skill:debug-methodology`).

## OpenCode

Skills are auto-discovered from `.claude/skills/` and `.codex/skills/` paths. Add this to your `opencode.json`:

```json
{
  "plugin": ["embedded-workbench@git+https://github.com/AmethystLuna/embedded-workbench.git"]
}
```

Or install through `skop`, which consumes the Claude marketplace manifest. See `.opencode/INSTALL.md`.

## ZCode (Z.AI)

ZCode 3.0+ follows the Agent Skills standard. It has no plugin marketplace, so copy the skills yourself:

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git
cp -r embedded-workbench/skills/* .zcode/skills/
```

Skills are invoked with `$skill-name`. ZCode also auto-discovers from `.claude/skills/` and `.codex/skills/`. See `.zcode/INSTALL.md`.

## Requirements

- Host: Claude Code v2.1+ / Codex CLI latest / Cursor 2.5+ / Kimi CLI latest / OpenCode latest / ZCode 3.0+
- DeepSeek Harness (dsh): dev preview, declared support for `>= 0.1.0-rc.7`. The latest round measured install, mount, boot and uninstall on 0.2.1-alpha.1. The earlier round measured 0.1.5-rc.2 through 0.2.0-rc.2. Per-release evidence is in [DSH-COMPATIBILITY.md](DSH-COMPATIBILITY.md).
- The Web Plugins-page "Gate injection" switch requires **dsh ≥ 0.1.7-alpha.1**, because its settings service must be able to project live fields. On older dsh the plugin and its 8 skills still load and still inject. The switch is simply absent, with no error.
- No external dependencies.

## Configuration

In DeepSeek Harness the bundle accepts a small configuration object:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Set to `false` to drop the first-step gate injection entirely. Skill registration is unaffected. |
| `gateContent` | string | built-in gate text | Override the text injected into the first model step. |

The switch is editable live in the dsh Web GUI: sidebar **Plugins** → this plugin's card → "Gate injection". It takes effect without a profile restart, and it controls only the injected text. Turning it off leaves all eight skills registered. The same card also carries a coarser row switch: turning that one off unmounts the whole row, so the skills and this switch disappear together. Persistent overrides still go through the profile patch below.

To override the row by id, edit your profile's `cordis.patch.yml`. The example below customises the gate text:

```yaml
- insert:
    - id: embedded-workbench
      name: 'dsh-embedded-workbench'
      config:
        enabled: true
        gateContent: |
          ...
```

## Uninstall

- If you installed through the DSH plugin manager, remove the `embedded-workbench` plugin from the target profile with the same manager.
- If you copied `skills/*` manually, delete the copied skill directories from `~/.agents/skills/` or the project's `.dsh/skills/`.
- If you added the bundle as a `cordis.patch.yml` row, remove the row with `id: embedded-workbench` from the profile patch and restart DSH.

## Permissions & Data

- The plugin runtime reads only the `skills/` directory shipped inside the package, in order to register skills through DSH's standard filesystem skill provider.
- It injects the configured gate text into the first model step of a session.
- It does not read credentials, open network connections, or touch user data outside the DSH session context.
- When the skills are actually used, the model may read project files as directed by the user, just like any other coding skill.

## Troubleshooting

- Skills not visible in DSH: confirm the DSH version supports `ctx.skills` and Agent Skills discovery, then restart the profile.
- Gate not injected: check that `enabled` is not `false`, and that the row id `embedded-workbench` is present in the active profile patch.
- Plugin manager rejects the installation: make sure the `@deepseek-ai/*` packages are declared as `peerDependencies`, not as regular `dependencies`.
- After a manual copy DSH still does not see the skills: install the native bundle instead (`dsh plugin add "github:AmethystLuna/embedded-workbench"`).

## Development

```bash
npm install
npm run typecheck
npm run build
```

Run the DSH skills registration test and the trigger tests:

```bash
node tests/dsh-skills-registration.test.mjs
bash tests/skill-triggering/run-all.sh
```

## License & Security

Licensed under MIT. See [LICENSE](LICENSE).

To report a security vulnerability, do **not** open a public issue. Use the private Security Advisory path or the contact method in [SECURITY.md](SECURITY.md).

## Other Plugins Recommended

| Plugin | Description |
|--------|-------------|
| [logicprobe](https://github.com/AmethystLuna/logicprobe) | Claim-verification skill: checks every verifiable claim in design docs, architecture specs, and refactoring plans against the codebase, and escalates behavioral claims to executable-model verification. It was split out of this plugin. The Plan Verification Gate prefers it, and falls back to the built-in `fact-check` skill when it is not installed. Install with `claude plugin install logicprobe@logicprobe`, or on dsh with `dsh plugin --profile <name> add dsh-logicprobe`. |
| [superpowers](https://github.com/obra/superpowers) | The original agent discipline engine: skill loading enforcement, Red Flags, subagent-driven development. Many of this plugin's agent-compliance patterns (1% Rule, Red Flags, `<SUBAGENT-STOP>`, instruction priority) were adapted from Superpowers. |

## Acknowledgments

This plugin's agent-compliance architecture is adapted from [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT License). These patterns were especially influential:

- **1% Rule**: agents resist loading skills and need extreme language to overcome that bias
- **Red Flags table**: enumerating agent rationalizations to short-circuit them
- **`<SUBAGENT-STOP>`**: preventing subagents from re-loading bootstrap context
- **Instruction Priority**: user > skills > system prompt hierarchy
- **Skill Types**: Rigid vs Flexible classification
- **Session-start hook injection pattern**: injecting capability context at session start
- **Trigger test framework**: `tests/skill-triggering/` structure and methodology

Superpowers is a general-purpose development plugin. Embedded Workbench applies the same discipline patterns to the embedded C/C++ domain.
