[中文](README.zh-CN.md)

---

# Embedded Workbench

Embedded C/C++ firmware toolbox — 4 agents, 8 skills covering FreeRTOS, ISR, NVM storage, Keil MDK (AC5/AC6), ARMCLANG, HardFault triage, state machines, architecture principles, LVGL patterns, logic-primitive verification, and adversarial design probing. v0.4.0.

**Cross-platform** — works with Claude Code, Codex CLI, Cursor, Kimi CLI, OpenCode, and ZCode. Built on the [Agent Skills](https://agentskills.io) open standard.

## Components

### Agents (4)

| Agent | Model | Description |
| ------- | ------- | ------------- |
| `architecture-steward` | opus / gpt-5.4 | Read-only planning: design packages, module boundaries, slice breakdown |
| `design-reviewer` | sonnet / gpt-5.3-codex | Design doc fact-check: verifies claims against codebase |
| `execution-worker` | sonnet / gpt-5.3-codex | Plan → approve → implement cycle with build verification |
| `quality-coordinator` | sonnet / gpt-5.3-codex | Implementation review: bugs, compliance, closure |

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
| `fact-verification` | Document & plan claim verification, logic-primitive verification (7 structural + 7 adversarial probes), refactoring regression detection, manual fallback mode |

### Deep References

`embedded-firmware-dev`, `debug-methodology`, `state-machine-design`, `c-cpp-dev`, and `fact-verification` include in-depth reference material and code examples. Highlights: 12 architecture principles, embedded patterns (GIF timer safety, state latches, async lifecycle), LVGL pitfalls, 7-round iterative debugging case study, state machine implementation patterns, embedded C specifics (volatile MMIO, linker sections, ISR wrappers), logic-primitive verification pipeline (7 structural + 7 adversarial probes), and automated verification harness (Python + manual fallback).

## Installation

### Marketplace install (recommended)

Add the marketplace to `~/.claude/settings.json`:

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

### Manual install

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

## Usage

The plugin auto-injects a capability notification at session start with a skill table, 1% Rule, and Red Flags reinforcement. Skills are loaded on demand:

- Say "use Multi-Agent Workflow" or invoke `Skill("embedded-workbench")` for the full workflow system
- Domain skills activate automatically when their `Use when` description matches your task — NOT clauses prevent false triggers (e.g., formatting-only won't load c-cpp-dev)
- The agent proactively suggests verification, adversarial probing, and parallel subagents when it detects state machines, behavioral claims, or multi-module tasks
- No manual CLAUDE.md configuration required

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
- No external dependencies

## Other Plugins Recommended

| Plugin | Description |
|--------|-------------|
| [powershell-safety](https://github.com/AmethystLuna/powershell-safety) | PowerShell safety rules — garbled text detection, file encoding pitfalls (BOM, UTF-16 LE vs UTF-8), native executable piping, quoting, and destructive command patterns |
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
