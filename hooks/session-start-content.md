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
| fact-check | Claim-by-claim verification of docs/plans against the codebase — built-in fallback when logicprobe is not installed | State machines / behavioral claims needing model verification (use logicprobe) |

> **⚠️ logicprobe 已拆分为独立插件 / moved to a standalone plugin** (v0.6.0):
> The full claim-verification skill with executable model verification (logic-primitive verification, adversarial probing, refactoring regression detection) now lives in its own plugin: <https://github.com/AmethystLuna/logicprobe>
> This plugin ships a built-in simplified fallback — `Skill("fact-check")` — for claim-by-claim verification when logicprobe is not installed. Install logicprobe with `claude plugin install logicprobe@logicprobe` (or clone to `~/.claude/plugins/dev/logicprobe`). Without it, behavioral/model claims degrade to manual confirmation mode.

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
| "I've explored enough, time to exit plan mode" | ExitPlanMode is the verification gate. Have you loaded `Skill("logicprobe")` or, if it is not installed, the built-in fallback `Skill("fact-check")`? Every plan must pass this gate before exit. |
| "This plan is too simple for logicprobe" | logicprobe auto-classifies depth; the fallback fact-check verifies every claim regardless. You don't decide. |
| "I already read the code, I know the file paths are correct" | Load `Skill("logicprobe")` or the fallback `Skill("fact-check")`, verify each claim, append the `## Plan Verification` block. |

**Plan Verification Gate**: Before `ExitPlanMode`, exactly one of:
1. Load `Skill("logicprobe")` (standalone plugin) — full verification, including executable model checks for behavioral claims; OR
2. If logicprobe is not installed, load the built-in fallback `Skill("fact-check")` (claim-by-claim verification with evidence), tell the user that behavioral/model claims degrade to manual confirmation, and recommend installing logicprobe.
If neither is loaded, inform the user "此计划未经核查，是否需要我先做事实核查？（This plan has not been fact-verified. Would you like me to verify before approving?）" Silent skip is not an option.

To load workflows and engineering policies: Skill("embedded-workbench")

**Proactive features**: When you see state machines, protocol refactoring, behavioral claims ("always"/"never"), or multi-module tasks — suggest verification (logicprobe, or the built-in fact-check fallback if logicprobe is not installed), adversarial probing, or parallel subagents BEFORE the user asks. Most users do not know these exist.
</EXTREMELY_IMPORTANT>
