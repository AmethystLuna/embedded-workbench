# Embedded Workbench

<p align="center"><strong>English</strong> · <a href="README.md">中文</a></p>

[![HOL Guard Scanner](https://img.shields.io/badge/HOL%20Guard-passing-00a67e)](https://github.com/hashgraph-online/hol-guard)

Embedded C/C++ firmware toolbox — 4 agents, 8 skills covering FreeRTOS, ISR, NVM
storage, Keil MDK (AC5/AC6), ARMCLANG, HardFault triage, state machines,
architecture principles, LVGL patterns, and claim fact-checking.

**Cross-platform** — works with Claude Code, Codex CLI, Cursor, Kimi CLI, OpenCode, ZCode, and DeepSeek Harness (dsh). Built on the [Agent Skills](https://agentskills.io) open standard.

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
| `hardfault-triage` | Processor exception triage — fault registers, stack frames, PC-to-source, root-cause classification |
| `fact-check` | Claim-check fallback: verifies API names, file paths, enum values, counts, and mechanism feasibility against the codebase; used by the Plan Verification Gate when logicprobe is not installed |

`logicprobe` (design-doc & plan claim verification) was **split out into its own plugin** — see [Other Plugins Recommended](#other-plugins-recommended). When it is not installed, the Plan Verification Gate falls back to this plugin's built-in `fact-check` skill; only behavioral/model claims degrade to manual confirmation.

> The skill content is mostly distilled from the author's personal embedded/firmware engineering experience and code-cleanliness discipline, based on real-world pitfalls and engineering constraints.

### Deep References

`embedded-firmware-dev`, `debug-methodology`, `state-machine-design`, and `c-cpp-dev` include in-depth reference material and code examples. Highlights: 12 architecture principles, embedded patterns (GIF timer safety, state latches, async lifecycle), LVGL pitfalls, 7-round iterative debugging case study, state machine implementation patterns, and embedded C specifics (volatile MMIO, linker sections, ISR wrappers).

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

Then install from CLI:

```bash
claude plugin install embedded-workbench@embedded-workbench
```

### Claude Code manual install

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git ~/.claude/plugins/dev/embedded-workbench
```

Then enable in `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "embedded-workbench@dev": true
  }
}
```

## DeepSeek Harness (dsh)

Native dsh support ships as a cordis plugin bundle at the repository root (the root `package.json` declares `dsh.bundle`):

- The skills are discovered as-is by dsh's `skill-filesystem` provider (Agent Skills open standard) — zero code.
- The bundle folds a **trimmed** first-model-step gate (the Plan Verification Gate plus a context-budget rule) into the first model step of every agent session — the dsh-native counterpart of the Claude `SessionStart` hook — and always registers the model-visible catalog entry (`cordis_inspect`). For why the 1% Rule and the Red Flags table left the payload, see [Design trade-offs and feedback](#design-trade-offs-and-feedback).
- The 4 custom agents are intentionally not ported — dsh's native subagent tooling covers parallel multi-agent work.

Install (native bundle, recommended):

```bash
# from npm (package name: dsh-embedded-workbench)
dsh plugin --profile web add dsh-embedded-workbench
# or from GitHub source
dsh plugin --profile web add "github:AmethystLuna/embedded-workbench"
# when dsh is not installed globally
npx -p @deepseek-ai/dsh dsh plugin --profile web add dsh-embedded-workbench
```

Restart the profile, then run `dsh --profile web --dump-config`: the `id: embedded-workbench` row must appear with `enabled: true`. More options (plain skill copy, project-level, ...) are in [`.dsh/INSTALL.md`](.dsh/INSTALL.md).

> DSH install note: the package name is `dsh-embedded-workbench`. In the web profile's `package.json`, both the dependency key and the `dsh.profile.bundles` entry must use the same name; a mismatch causes the dsh loader to fail with `ERR_MODULE_NOT_FOUND`.

## Usage

Skills load on demand and do not depend on injection:

- Invoke `Skill("embedded-workbench")` for the workflow and engineering policies — it picks a light or full path by risk, and does not force fixed stages
- Domain skills activate automatically when their `Use when` description matches your task — NOT clauses prevent false triggers (e.g., formatting-only won't load c-cpp-dev)
- The agent proactively suggests verification, adversarial probing, and parallel subagents when it detects state machines, behavioral claims, or multi-module tasks
- No manual CLAUDE.md configuration required

The plugin also folds a **trimmed** gate (about 400 tokens) into the first model step, carrying just two things: the Plan Verification Gate, and a context-budget rule (never guess a readout you cannot see; when a large step shows no signal, ask the user to decide). Set `enabled: false` to drop it entirely.

## Design trade-offs and feedback

This revision walks back an earlier decision on the evidence, and the reasoning is below — challenge it.

**Background.** We checked the official documentation for all 8 supported harnesses one by one (and read the source for Codex CLI). One assumption did not survive: **7 of the 8 expose no context-budget readout to the model at all** (Claude Code, Copilot CLI, Cursor, OpenCode, Kimi CLI, ZCode and dsh show token figures only in the user's interface; only Codex has a `get_context_remaining` tool, and it is off by default). Asking the model to judge "do I have budget to delegate?" therefore had nothing to stand on.

**So we changed two things.**

1. **Cost is now managed by trimming, not by switching injection off.** The first-step gate carries only two things: the **Plan Verification Gate** (verify, or tell the user you did not) and a **context-budget rule** (never guess a readout; when a large step shows no signal, ask the user to decide). The payload went from ~1,400 tokens to ~400 (Claude side −72%, dsh side −58%, measured) and it is on by default.
2. **The verification gate stays; the enforcement scaffolding goes.** The 1% Rule and the 9-row Red Flags table left the **injected payload** because they are enforcement, and reported experience shows capable models follow that kind of prompt pressure literally — producing rigid phases, unnecessary questions, and six or seven agents on a five-line task at 10–15× overhead (see [obra/superpowers#1120](https://github.com/obra/superpowers/issues/1120), [openai/codex#22005](https://github.com/openai/codex/issues/22005), [#20366](https://github.com/openai/codex/issues/20366)). The full table still lives in `Skill("embedded-workbench")`: the discipline is available on request rather than applied to everyone by default. Workflow selection likewise moved from a fixed agent chain to **risk-proportional** paths.

**Deliberately kept.** The Plan Verification Gate is intact (logicprobe → the built-in `fact-check` when it is not installed → tell the user if you used neither). Following [Superpowers Lite](https://github.com/BB-84C/superpowers-lite), safety, permission and **verification** gates are the kind to keep; process ceremony is the kind to scale back.

**Known uncertainty.** These budget interfaces change fast and we checked once, on 2026-09-25. Every cell a vendor does not document is marked `UNVERIFIED` in [`platform-tool-mapping.md`](skills/embedded-workbench/references/platform-tool-mapping.md) rather than filled in by analogy.

**Disagree?** These are judgement calls, not settled facts — especially "the Red Flags table leaves the payload" and "the gate is on by default". Open an [issue](https://github.com/AmethystLuna/embedded-workbench/issues) with the model tier, harness and counter-example you are working with; we would rather adjust on evidence.

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

Skills are invoked with `$skill-name` (e.g. `$debug-methodology`) or auto-selected by Codex based on task context.

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

Skills are auto-discovered from `.claude/skills/` and `.codex/skills/` paths. Add to your `opencode.json`:

```json
{
  "plugin": ["embedded-workbench@git+https://github.com/AmethystLuna/embedded-workbench.git"]
}
```

Or install via `skop` which consumes the Claude marketplace manifest. See `.opencode/INSTALL.md` for detailed instructions.

## ZCode (Z.AI)

ZCode 3.0+ follows the Agent Skills standard. No plugin marketplace — manually copy skills to `.zcode/skills/`:

```bash
git clone https://github.com/AmethystLuna/embedded-workbench.git
cp -r embedded-workbench/skills/* .zcode/skills/
```

Skills are invoked with `$skill-name`. ZCode also auto-discovers from `.claude/skills/` and `.codex/skills/`. See `.zcode/INSTALL.md` for details.

## Requirements

- Claude Code v2.1+ / Codex CLI latest / Cursor 2.5+ / Kimi CLI latest / OpenCode latest / ZCode 3.0+
- DeepSeek Harness (dsh): dev preview — supports `>= 0.1.0-rc.7` (the standing declaration; this round re-measured 0.1.5-rc.2 / 0.1.5-rc.3 / 0.1.6-alpha.2 / 0.1.7-alpha.1 / 0.1.7-alpha.2 / 0.1.7-rc.1 / 0.1.7-rc.2 / 0.2.0-rc.1 / 0.2.0-rc.2 — per-release evidence in [DSH-COMPATIBILITY.md](DSH-COMPATIBILITY.md))
- The Web Plugins-page "Gate injection" switch requires **dsh ≥ 0.1.7-alpha.1** — its settings service must project live fields. On older dsh the plugin and its 8 skills still load and still inject, with the switch simply absent and **no error**: below schemastery 3.18.3 the field degrades to an ordinary boolean, and a settings service without `whileServed` makes the client half register nothing.
- No external dependencies

## Configuration

In DeepSeek Harness, the bundle accepts a small configuration object:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Set to `false` to drop the first-step gate injection entirely; skill registration is unaffected. |
| `gateContent` | string | built-in gate text | Override the text injected into the first model step. |

The switch is editable live in the dsh Web GUI: sidebar **Plugins** → this plugin's card → "Gate injection". It takes effect without a profile restart and controls only the injected text — turning it off leaves all eight skills registered. The same card also carries a coarser row switch: turning that off unmounts the whole row (the skills and this switch go with it). Persistent overrides still go through the profile patch below.

To change it, override the row by id in your profile's `cordis.patch.yml` (the example below customises the gate text):

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

- If you installed through the DSH plugin manager, remove the `embedded-workbench` plugin from the target profile using the same manager you used to install it.
- If you copied `skills/*` manually, delete the copied skill directories from `~/.agents/skills/` or the project `.dsh/skills/`.
- If you added the bundle as a `cordis.patch.yml` row, remove the row with `id: embedded-workbench` from the profile patch and restart DSH.

## Permissions & Data

- The plugin runtime reads only the `skills/` directory shipped inside the package, in order to register skills through DSH's standard filesystem skill provider.
- It injects the configured gate text into the first model step of a session.
- It does not read credentials, open network connections, or access user data outside the DSH session context.
- When the skills are actually used, the model may read project files as directed by the user, just like any other coding skill.

## Troubleshooting

- Skills not visible in DSH: confirm you are on a DSH version that supports `ctx.skills`/Agent Skills discovery, and restart the profile after install.
- Gate not injected: check that `enabled` is not `false` and that the row id `embedded-workbench` is present in the active profile patch.
- Plugin manager rejects installation: make sure `@deepseek-ai/*` packages are declared as `peerDependencies`, not regular `dependencies`.
- After manual copy, DSH still doesn't see the skills: use the native bundle install (`dsh plugin add "github:AmethystLuna/embedded-workbench"`) instead of copying.

## Development

```bash
npm install
npm run typecheck
npm run build
```

Run the DSH skills registration test and trigger tests:

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
| [logicprobe](https://github.com/AmethystLuna/logicprobe) | Claim-verification skill: checks every verifiable claim in design docs, architecture specs, and refactoring plans against the codebase, escalating behavioral claims to executable-model verification. Split out of this plugin; the Plan Verification Gate prefers it and falls back to the built-in `fact-check` skill when it is not installed. Install with `claude plugin install logicprobe@logicprobe` (on dsh: `dsh plugin --profile <name> add dsh-logicprobe`). |
| [superpowers](https://github.com/obra/superpowers) | The original agent discipline engine — skill loading enforcement, Red Flags, subagent-driven development. Many of this plugin's agent-compliance patterns (1% Rule, Red Flags, `<SUBAGENT-STOP>`, instruction priority) were adapted from Superpowers. |

## Acknowledgments

This plugin's agent-compliance architecture is adapted from [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT License). Specific patterns adapted with gratitude:

- **1% Rule** — the insight that agents resist loading skills and need extreme language to overcome that bias
- **Red Flags table** — enumerating agent rationalizations to short-circuit them
- **`<SUBAGENT-STOP>`** — preventing subagents from re-loading bootstrap context
- **Instruction Priority** — user > skills > system prompt hierarchy
- **Skill Types** — Rigid vs Flexible classification
- **Session-start hook injection pattern** — injecting capability context at session start
- **Trigger test framework** — `tests/skill-triggering/` structure and methodology

Superpowers is a general-purpose development plugin. Embedded Workbench applies the same discipline patterns to the embedded C/C++ domain.
