# Embedded Workbench

Embedded C/C++ firmware toolbox for Claude Code. 4 agents, 8 skills covering FreeRTOS, ISR, NVM storage, Keil MDK (AC5/AC6), ARMCLANG, HardFault triage, state machines, architecture principles, and LVGL patterns.

## Components

### Agents (4)

| Agent | Model | Description |
| ------- | ------- | ------------- |
| `architecture-steward` | opus | Read-only planning: design packages, module boundaries, slice breakdown |
| `design-reviewer` | sonnet | Design doc fact-check: verifies claims against codebase |
| `execution-worker` | haiku | Plan → approve → implement cycle with `Bash` verification |
| `quality-coordinator` | sonnet | Implementation review: bugs, compliance, closure |

### Skills (8)

| Skill | Description |
| ------- | ------------- |
| `embedded-workbench` | Bootstrap: workflows, policies, sub-agent mapping, document templates |
| `debug-methodology` | 8 iron rules, fix principles, iterative debugging case study |
| `embedded-firmware-dev` | FreeRTOS, ISR, NVM storage, async lifecycle, boundary analysis, architecture principles, LVGL pitfalls |
| `keil-mdk-build` | UV4 CLI, ARM Compiler 5/6, .map analysis, merge/packaging, HardFault triage |
| `c-cpp-dev` | Code generation, style, memory layout, refactoring for C/C++ |
| `state-machine-design` | State models, retries, timeouts, transition gates |
| `powershell-safety` | PowerShell syntax, quoting, file encoding, safety rules |
| `fact-verification` | Document claim verification against codebase |

### Deep References

`embedded-firmware-dev` and `debug-methodology` include in-depth reference material: 12 architecture principles, embedded patterns (GIF timer safety, state latches, async lifecycle), LVGL pitfalls, and a 7-round iterative debugging case study.

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

The plugin auto-injects a capability notification at session start. Skills are loaded on demand:

- Say "use Multi-Agent Workflow" or invoke `Skill("embedded-workbench")` for the full workflow system
- Domain skills activate automatically when their `Use when` description matches your task
- No manual CLAUDE.md configuration required

## Requirements

- Claude Code v2.1+
- No external dependencies
