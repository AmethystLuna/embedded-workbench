# SessionStart hook: lightweight capability notification
param()
$ErrorActionPreference = "Stop"

$message = @'
<EXTREMELY_IMPORTANT>
Plugin embedded-workbench is active. You have access to custom agents and skills for embedded C/C++ firmware development.

**Agents**: architecture-steward, design-reviewer, execution-worker, quality-coordinator

**Skills** — invoke with Skill("name") when the task matches:

| Skill | Use when | NOT for |
|-------|----------|---------|
| debug-methodology | Debugging crashes, HardFault, logs, or sensor anomalies | Fault-register triage (use hardfault-triage) |
| c-cpp-dev | Writing or refactoring embedded C/C++ code on ARM targets | Formatting-only, simple reads, C# or non-embedded |
| embedded-firmware-dev | FreeRTOS, ISR, NVM storage, async lifecycle, boundary analysis | Documentation-only RTOS references |
| keil-mdk-build | Keil MDK/ARMCLANG builds, .map analysis, build diagnostics | Non-Keil builds (Makefile, CMake, IAR, GCC-only) |
| state-machine-design | Async protocols, retries, ACK/NACK, timeout logic in embedded firmware | Generic network protocol design (TCP/HTTP/MQTT) |
| hardfault-triage | Processor exception triage, fault registers, stack frames, PC-to-source | — |
| fact-verification | Design doc/plan review, claim verification, logic primitive + adversarial probing for behavioral claims | — |

**1% Rule**: If there is even a 1% chance a skill applies to your task, invoke it before responding. If the skill turns out to be wrong for the situation, discard it and move on. The cost of loading a skill is trivial compared to the cost of a preventable mistake.

**Red Flags** — if you think any of these, STOP. You are rationalizing:

| You think | Reality |
|-----------|---------|
| "This is just a quick fix" | Quick fixes break things. A 3-line design check costs 30 seconds. |
| "I already understand this code" | You are looking at one file. The blast radius may span 5 modules. |
| "The skill is overkill for this" | Simple things become complex. Check for skills. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can just read the file directly" | Skills have patterns and pitfalls you will not discover by reading. |
| "I remember this skill content" | Skills evolve. Always load the current version. |

To load workflows and engineering policies: Skill("embedded-workbench")

**Proactive features**: When you see state machines, protocol refactoring, behavioral claims ("always"/"never"), or multi-module tasks — suggest verification, adversarial probing, or parallel subagents BEFORE the user asks. Most users don't know these exist.
</EXTREMELY_IMPORTANT>
'@

# JSON-escape
$escaped = $message -replace '\\', '\\' -replace '"', '\"' -replace "`n", '\n' -replace "`r", ''

$json = "{`"hookSpecificOutput`": {`"additionalContext`": `"$escaped`"}}"
Write-Output $json
