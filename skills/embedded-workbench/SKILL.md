---
name: embedded-workbench
description: "Use when starting any non-trivial coding task — loads risk-proportional workflows, engineering policies, and principles for embedded C/C++ firmware development. NOT for trivial single-line fixes, formatting-only changes, or read-only queries."
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task (implementation, review, search), skip this bootstrap skill. You already have your task instructions. Only load domain skills relevant to your specific task.
</SUBAGENT-STOP>

# Embedded Engineering Workflow

Core workflow system and engineering principles.

## Instruction Priority

This plugin's skills and policies override default system behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, AGENTS.md, project rules, direct requests) — highest priority
2. **Plugin skills and workflows** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

If a user's CLAUDE.md says "skip design review for hotfixes" and the workflow requires it, follow the user. The user is in control.

## Platform Adaptation

This plugin's skills and agents use Claude Code tool names (`Read`, `Write`, `Edit`, `Bash`, `Skill()`). If you are NOT on Claude Code, load `references/platform-tool-mapping.md` for the tool name equivalents on your platform (Codex CLI, Cursor, Kimi CLI, OpenCode, ZCode, Copilot CLI, DeepSeek Harness). On DeepSeek Harness (dsh) the names are lowercase (`read`/`write`/`edit`/`glob`/`grep`/`pwsh`), skills load through the `skill` tool, the plan gate is `exit_plan_mode`, parallel work uses `subagent`/`subagent_fork`, and the 4 custom agents below are not ported.

## Red Flags

If you catch yourself thinking any of these, STOP — you are rationalizing:

| You think | Reality |
|-----------|---------|
| "This is just a quick fix, I don't need a plan" | Quick fixes are the most likely to break something else. A 3-line design check costs 30 seconds. |
| "I already understand the architecture" | You're looking at one file. The blast radius may span 5 modules you haven't read. |
| "The worker can figure out the details" | The worker has NO context from previous calls. A vague plan = the worker guessing. |
| "I'll review it myself, no need for quality-coordinator" | Self-review is enough for a bounded, reversible edit. A second pass earns its cost when the blast radius is unclear or the change is hard to undo. |
| "This change is too small for a Detailed Change Plan" | Bounded, reversible, single-site edits do not need the ceremony. Crossing a module boundary, a public interface, or a non-obvious failure mode does. Name the invariants either way. |
| "I've explored enough, time to exit plan mode" | ExitPlanMode is the verification gate. Have you loaded `Skill("logicprobe")` or, if it is not installed, the built-in fallback `Skill("fact-check")`? Every plan — simple or complex — must pass this gate before exit. |
| "This plan is too simple for logicprobe" | logicprobe auto-classifies depth (LIGHTWEIGHT/STANDARD/ESCALATED); the fallback fact-check verifies every claim regardless. You don't decide whether verification is needed. |
| "I already read the code, I know the file paths and API names are correct" | Organic verification leaves no audit trail. Load `Skill("logicprobe")` or the fallback `Skill("fact-check")`, verify each claim, append the `## Plan Verification` block. |

---

## General Principles

- Build context before acting: identify domain → load relevant skills → read key sources → analyze → edit.
- **Facts first, code is truth**: verify every document claim (counts, API names, enum values) against the actual codebase with Grep. Design on verified facts, not assumptions.
- For a broad search that would otherwise take many Grep/Glob rounds, a read-only `Explore` sub-agent keeps the noise out of this context — but two direct searches are cheaper than dispatching one.
- Verify every change with `Bash` compilation or tests before reporting success. No verification = no claim of success.
- Reference file locations with line numbers in all reports: `[path/to/file.c#L100-L110]`.
- Write project memory to `<workspace>/.github/memory/`, update `MEMORY.md` index. Personal preferences only in `~/.claude/projects/.../memory/`.

---

## Proportionality

Match the process to the risk in front of you, not to habit. Start on the lightest path that covers the risk, and escalate only when you actually cross a boundary.

| Task shape | Path |
| --- | --- |
| Question, read-only investigation, or a bounded reversible edit (typo, constant, one call site) | Do it directly — no plan header, no sub-agent |
| One module, known repro, local refactor | Lite |
| Cross-module, public interface, shared-state ownership, new state machine, non-obvious failure/recovery mode | Full |
| Platform layer, contracts, staged migration | Full + audit matrix |

You have crossed into a heavier path when the change spans more than one module, alters a public interface or state ownership, hides a failure mode you cannot describe, or two attempts have not converged. Scaling a bounded edit up costs more than the edit.

## Context Budget

Complexity decides **how much process**; the budget decides **whether to split the window**. Split it for discovery whose detail you will not cite again — a suite, a log sweep, docs, several independent areas. Keep it for phases that share context (plan → implement → test), or when the change is quick and latency matters.

**You cannot see your budget**: most harnesses show a token count to the user's interface, not to you, so never guess one. Act on what you do see — a result truncated, pruned, or spilled to a file, or a compaction / checkpoint summary. When a large step shows no signal at all, **ask the user** what to spend context on rather than deciding silently; if nobody can answer (headless run), take the reversible option and say so.

Delegation is not free: the sub-agent spends its own tokens and its summary still lands here. When it needs context you already built, inherit it (dsh `subagent_fork`; Codex `fork_turns`, default `all`; Claude Code fork mode; Kimi `/btw`) instead of rebuilding it in a prompt. Per-harness markers and tool names: `references/platform-tool-mapping.md`.

Delegation is not free: the sub-agent spends its own tokens, its summary still lands in this context, and its window is sized by *its* model, not this one. If the returns would be verbose, ask before delegating. Prefer read-only delegation when the point is to discard detail. When the delegated work needs the context you have already built, inherit it (dsh `subagent_fork`; Codex `fork_turns`, which defaults to `all`; Claude Code forked subagent; Kimi `/btw`) rather than rebuilding it inside a prompt (dsh `subagent`, Claude Code fresh subagent).

## Workflows

Sub-agents are **optional equipment, not mandatory stages** — dispatch one when it buys something concrete (a frozen plan, context isolation, an independent review pass), never as ceremony. Each `Agent()` call is stateless: it sees only what its prompt contains. Choose isolation when the detail can be discarded, and inheritance when the sub-agent needs the context you already built (see Context Budget above).

### Lite — one module, known repro

Plan the change, make it, verify it. Self-review is sufficient for a bounded, reversible edit.

If the plan rests on claims about the codebase (API names, file paths, enum values, counts), verify those claims before implementing — inline for a small change, or with `logicprobe` / the built-in `fact-check` skill. Escalate to Full when the change turns out to cross a boundary, or when two revisions fail to converge.

### Full — cross-module, new interfaces, state-ownership changes

Design first (module boundaries, slice breakdown, recovery paths), then per slice: plan → approve → implement → verify → close. Add an independent review pass (`quality-coordinator`, or a `subagent` with a review prompt) when the change is hard to reverse or the blast radius is unclear; for a well-bounded slice, self-review plus verification evidence is enough.

### Framework — platform layer, contracts, staged migration

Full, plus an audit matrix and rollback triggers; each slice reports its audit delta.

### Sub-Agents

| Agent | Role | When it earns its cost |
| ------- | ------ | ------ |
| `architecture-steward` | Read-only planning: design packages, module boundaries, slice breakdown | A design spanning modules you have not read |
| `design-reviewer` | Design doc fact-check: verifies claims against codebase before implementation | The plan rests on claims you have not verified |
| `execution-worker` | Plan round → Detailed Change Plan. Implement round → edit + verify | You want the plan frozen before edits, or a noisy investigation kept out of this context |
| `quality-coordinator` | Implementation review: bugs, compliance, closure completeness | The change is hard to reverse or the risk surface is wide |

These are roles, not gates: the main model can play any of them directly when that is cheaper.

---

## Plan Mode Integration

Claude Code's built-in `EnterPlanMode` / `ExitPlanMode` maps to the **plan phase** of the Lite and Full paths. Plan mode is a read-only exploration + plan-writing phase — it does NOT exempt you from embedded-workbench verification gates.

### Plan Verification Gate

> **⚠️ logicprobe 已拆分为独立插件 / moved to a standalone plugin** (v0.6.0): the full verification skill (executable model checks, adversarial probing) now ships in its own plugin — <https://github.com/AmethystLuna/logicprobe> (install commands are in the README's "Other Plugins"). This plugin ships a built-in simplified fallback — `Skill("fact-check")` — for claim-by-claim verification when logicprobe is not installed; behavioral/model claims then degrade to manual confirmation.

**Before calling `ExitPlanMode`**, exactly one of the following must happen:

1. **Load `Skill("logicprobe")`** (standalone plugin) — it classifies depth (LIGHTWEIGHT / STANDARD / ESCALATED), runs the verification including executable model checks, and appends a `## Plan Verification` summary block to the plan.
2. **Load `Skill("fact-check")`** (built-in fallback, only when logicprobe is not installed) — verifies every verifiable claim against the codebase with evidence, appends a `## Plan Verification` block marked `fact-check (fallback)`, and tells the user that state-machine/behavioral claims degrade to manual confirmation.
3. **Inform the user** — if you load neither, say: *"此计划未经核查。是否需要我在审批前运行事实核查？（This plan has not been fact-verified. Would you like me to run verification before approving?）"*

Silent skip is not an option. Plan mode permits `Read`, `Glob`, `Grep`, and `Skill` calls, so all of this executes before exit.

---

## Workflow Policies

<HARD-GATE>
### Approval Gate

- A slice that crosses a module boundary, changes a public interface or state ownership, or carries a non-obvious failure/recovery mode MUST have its plan written and approved before editing: objective, entry point, intended files, change shape, invariants, risks, validation, stop conditions.
- Bounded, reversible, single-site edits proceed without the ceremony — state the intent, make the change, verify the result.
- If execution reveals facts that change scope, boundaries, acceptance, or the verification surface, pause and re-approve.
</HARD-GATE>

<HARD-GATE>
### Closure Gate

- Work is not done until implementation intent, verification evidence, and residual risks are all explicit.
- Skipped checks MUST record a concrete reason. "Looks good" is not a reason.
- For fault/recovery scenarios, cover the normal, failure, and recovery paths.
- Documentation and memory updates are completed, or explicitly skipped with a reason.
</HARD-GATE>

### Escalation Triggers

- Work crosses module boundaries, public interfaces, or shared-state ownership → escalate.
- Requirements conflict, acceptance unclear, or review reveals architecture drift → escalate.
- Two plan revisions fail to converge → escalate.

### Context Transfer

Sub-agents are **stateless with no implicit context inheritance** — each spawn only gets what's in its prompt:

- **Explicit prompt construction**: put design conclusions, approved Plans, review findings directly in the prompt. Do NOT assume the agent "remembers" previous conversations.
- **Plan is the key handoff artifact**: when you do dispatch sub-agents, the Detailed Change Plan and review verdicts are the only bridge between Design → Plan round → Implement round. Vague Plans = the next agent guessing.
- **Pass only what's needed**: Design phase doesn't need full source code. Implement phase doesn't need the full Audit Matrix.
- **Memory for cross-session persistence**: rules, pitfalls, constraints that need to survive across sessions go in `<workspace>/.github/memory/`. In-session coordination stays in chat.
- **Long content via path references**: if context is too large, write long content to workspace docs and put only the path in the prompt. Let the agent Read it.

---

## Skill Types

Each domain skill is classified by how strictly it should be followed:

**Rigid** — follow exactly. These are rules and checklists. Don't adapt away the discipline.

- `debug-methodology`: 8 iron rules are non-negotiable
- `logicprobe` (external plugin): claim verification must check every claim
- `fact-check` (built-in fallback): claim-by-claim verification when logicprobe is not installed

**Flexible** — adapt principles to context. These are patterns and references, not commands.

- `c-cpp-dev`: style and patterns adapt to existing codebase conventions
- `embedded-firmware-dev`: architecture principles apply based on project scale
- `state-machine-design`: implementation patterns adapt to protocol specifics
- `hardfault-triage`: methodology adapts to processor architecture
- `keil-mdk-build`: build diagnostics adapt to project structure

If unsure, treat a skill as Rigid until you confirm otherwise.

## Skill Loading Priority

When multiple skills could apply, use this order:

1. **Diagnosis skills first** — `debug-methodology`, `hardfault-triage`, `logicprobe` (external plugin; use the built-in `fact-check` fallback if logicprobe is not installed). These determine WHAT is wrong.
2. **Design skills second** — `state-machine-design`. These determine HOW to fix it.
3. **Implementation skills third** — `c-cpp-dev`, `embedded-firmware-dev`, `keil-mdk-build`. These guide execution.

"HardFault crash" → hardfault-triage first, then debug-methodology if root cause is complex.
"Add retry logic" → state-machine-design first, then c-cpp-dev for implementation.
"Review this design" → logicprobe first (or the built-in fact-check fallback if logicprobe is not installed), then escalate findings to design-reviewer agent.

**Cross-domain links**: load a secondary skill only when the primary skill's findings call for it — don't pre-load. Each skill's own `Use when` and NOT clauses already tell you when it applies.

## Domain Skills

Load domain-specific guidance when the task matches. Skills marked with 📚 have deep reference material in their `references/` directory.

| Task | Skill | Type | Deep Refs |
|------|-------|:----:|:---------:|
| Debugging crashes, HardFault, logs | `Skill("debug-methodology")` | Rigid | 📚 case study |
| HardFault / exception triage, fault registers, .map crash resolution | `Skill("hardfault-triage")` | Flexible | — |
| C/C++ code generation or style | `Skill("c-cpp-dev")` | Flexible | — |
| FreeRTOS, ISR, NVM storage, sensor drivers | `Skill("embedded-firmware-dev")` | Flexible | 📚 architecture, patterns, LVGL |
| Keil MDK, ARMCLANG, build system, .map optimization | `Skill("keil-mdk-build")` | Flexible | — |
| State machines, retries, timeouts | `Skill("state-machine-design")` | Flexible | — |

Design doc review, claim verification, logic primitive + adversarial probing → `Skill("logicprobe")` — **standalone plugin**; when logicprobe is not installed, use the built-in `Skill("fact-check")` fallback for claim-by-claim verification (see Plan Verification Gate above).

## Templates & References

The `references/` directory holds the workflow document templates plus three notes. Read the file you need by name:

- `platform-tool-mapping.md` — tool-name equivalents for Codex/Cursor/Kimi/OpenCode/ZCode/Copilot/dsh, and the per-harness context-budget table. **Read this immediately if you are not on Claude Code.**
- `proactive-suggestions.md` — ready-to-use phrasings for the suggestions below.
- `INDEX.md` — the working-memory index template.
- Workflow templates: `detailed-change-plan.md`, `task-charter.md`, `iteration-notes.md`, `steward-memo.md`, `result-note.md`, `final-qc.md`, `decision-log.md`, `audit-ledger.md`, `contract-matrix.md`, `durable-requirement-notes.md`.

---

## Proactive Suggestions

Suggest a capability when it clearly applies and the user is unlikely to know it exists — state-machine verification for a state machine, a protocol, or an "always"/"never" claim; parallel sub-agents for genuinely independent modules; a design fact-check for a plan that had no review. Suggest **once per task**, say what the check finds rather than which tool runs it, and drop it if the user declines. Ready-to-use phrasings: `references/proactive-suggestions.md`.
