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

Complexity decides **how much process**; the context budget decides **whether to split the window**. They are separate decisions: a one-line change can still deserve a sub-agent when finding it means sweeping a log, and a cross-module design is often better kept in one conversation.

Split the window when the work is discovery whose detail you will not cite again — running a suite, sweeping logs, fetching documentation, searching several independent areas. Keep it in the main conversation when the phases share context (plan → implement → test), when you need to iterate back and forth, or when the change is quick and latency matters.

**You usually cannot see your budget.** Most harnesses expose a token count to the user's interface and not to you (`references/platform-tool-mapping.md` has the per-harness detail). So never invent a percentage, and never silently guess. Two cases:

**A signal you can actually observe** — a result truncated, pruned, or spilled to a file, or a compaction / checkpoint summary:

| You observe | Do |
| --- | --- |
| A tool result was truncated, pruned, or spilled to a file | Stop pulling the whole thing in. Read the file selectively, or hand the sweep to a read-only sub-agent — and say which you did. |
| A compaction or checkpoint summary appeared | You have already crossed the threshold once. Move durable state into files and prefer file references over pasted content. |
| A truncation flag, or a result list capped at N | Narrow the query before re-running it. |

**No signal, but the work is clearly large** — many sources, a long sweep, several independent areas, or phases that will not share context: **ask the user.** Say what you are about to consume, that this harness gives you no budget readout, and the options with their costs, then do what they choose. One question per task, not running commentary:

> This next step pulls ~20 files and a test log into the conversation. I can't see how much context is left here. Options: (a) delegate the sweep to a read-only sub-agent and keep only its summary, (b) read selectively and write findings to a file I reference by path, (c) read it all here. (a) and (b) cost less context but lose detail, and (a) also spends the sub-agent's own tokens.

If no user can answer (headless or non-interactive run), take the reversible option — read selectively, prefer paths over pasted content — and state that you assumed it.

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

> **⚠️ logicprobe 已拆分为独立插件 / moved to a standalone plugin** (v0.6.0): the full verification skill (executable model checks, adversarial probing) now ships in its own plugin — <https://github.com/AmethystLuna/logicprobe>. Install it with `claude plugin install logicprobe@logicprobe` (or clone to `~/.claude/plugins/dev/logicprobe`); on dsh, `dsh plugin --profile <name> add dsh-logicprobe`. This plugin ships a built-in simplified fallback — `Skill("fact-check")` — for claim-by-claim verification when logicprobe is not installed; behavioral/model claims then degrade to manual confirmation.

**Before calling `ExitPlanMode`**, exactly one of the following must happen:

1. **Load `Skill("logicprobe")`** (standalone plugin — install separately if missing) — the skill classifies depth (LIGHTWEIGHT / STANDARD / ESCALATED), runs verification (including executable model checks), and appends a `## Plan Verification` summary block to the plan file.
2. **Load `Skill("fact-check")`** (built-in fallback, only when logicprobe is not installed) — verifies every verifiable claim against the codebase with evidence, appends a `## Plan Verification` block marked `fact-check (fallback)`, and tells the user that state-machine/behavioral claims degrade to manual confirmation — recommend installing logicprobe.
3. **Inform the user** — if you choose not to load either skill, you MUST say: *"此计划未经核查。是否需要我在审批前运行事实核查？（This plan has not been fact-verified. Would you like me to run verification before approving?）"* The user must have the option to request verification before approving.

Silent skip is not an option. Either verify, or tell the user you didn't.

Plan mode permits `Read`, `Glob`, `Grep`, and `Skill` calls — all verification executes within plan mode before exit.

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

**Cross-domain links**: load secondary skills ONLY when the primary skill's findings indicate they are needed. Don't pre-load. `hardfault-triage` ↔ `keil-mdk-build` (.map file bridge — load keil-mdk-build only if .map analysis is needed). `hardfault-triage` ↔ `debug-methodology` (root-cause analysis — load debug-methodology only if the fault cause is complex). `embedded-firmware-dev` ↔ `state-machine-design` (state transitions — load state-machine-design only if state logic is involved). `embedded-firmware-dev` ↔ `debug-methodology` (debugging process). `logicprobe` ↔ `design-reviewer` agent (design doc review, logic verification). `logicprobe` ↔ `state-machine-design` (behavioral claim probing). `logicprobe` ↔ `fact-check` (built-in fallback when the logicprobe plugin is not installed).

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

This skill's `references/` directory contains document templates and platform references. Use `Read` with the skill's reference path to load the relevant file when needed:

### Platform

- `platform-tool-mapping.md` — Claude Code → Codex/Cursor/Kimi/OpenCode/ZCode/Copilot/dsh tool name equivalents. **Load this immediately if you are NOT on Claude Code.**

### Workflow Templates

- `detailed-change-plan.md` — Pre-edit implementation plan
- `task-charter.md` — Task scope and slice roadmap
- `iteration-notes.md` — Per-slice execution notes
- `steward-memo.md` — Pre-execution architecture framing
- `result-note.md` — Post-edit closure evidence
- `final-qc.md` — Formal review verdict
- `decision-log.md` — Approved decisions with rationale
- `audit-ledger.md` — Recurring audit tracking (Framework path)
- `contract-matrix.md` — Contract-to-sentinel mapping (Framework path)
- `durable-requirement-notes.md` — Long-lived business invariants

---

## Proactive Suggestions

When you observe any of these patterns in the user's task, **suggest the relevant feature before the user asks**. Most users don't know these capabilities exist.

| Pattern You Observe | Suggest |
|---------------------|--------|
| User describes refactoring a state machine (splitting/merging states, changing transitions) | "Before you start, would you like me to run logic-primitive verification on the refactoring? I can extract the current state machine from code, compare it against your plan, and flag any regressions, deadlocks, or behavioral deltas before you change a single line." |
| User describes a new state machine or protocol with ≥3 states | "I can run an adversarial verification on this design — 22 automated checks (8 structural S1–S8 plus 14 adversarial A1–A14) for deadlocks, unreachable states, race conditions, guard completeness, and invariant violations. Want me to do that before we implement?" |
| User pastes or writes a state enum + switch-case dispatcher | "I notice a state machine here. Would you like me to model it and run completeness checks? I can find missing transitions, detect absorbing error loops, and verify that every state is reachable." |
| User says "always" / "never" / "guaranteed" about behavior | "That's a behavioral invariant. I can model this and try to find a counter-example — the shortest event sequence that would violate 'X always happens before Y'. Want me to check?" |
| User reviews a PR or diff that touches a state machine file | "This PR changes state machine logic. Would you like me to extract the before/after models and verify no regressions were introduced?" |
| User debugs a crash or lockup in a stateful module | "This might be a state machine completeness issue. I can model the state machine from the code and check for deadlocks, unreachable states, or event ordering problems that could cause the lockup." |
| Task would benefit from parallel execution (multiple independent modules, files, or dimensions) | "These are independent. I can dispatch parallel subagents to handle each module concurrently and synthesize the results. Want me to do that?" |
| User writes a Detailed Change Plan without design review | "Before implementing, would you like the design-reviewer agent to fact-check this plan against the codebase? It catches API mismatches, missing modules, and mechanism feasibility issues before you write code." |

### Suggestion Rules

- **Suggest once per task**, not repeatedly. If the user declines, don't push.
- **Be specific about what the feature does** — don't just name-drop. Say "I can find deadlocks and missing transitions" not "I can run logicprobe." If logicprobe is not installed, offer the built-in fact-check skill: "I can check every claim in the plan against the codebase."
- **Estimate cost**: for lightweight checks, say "this takes ~30 seconds." For Python harness runs, say "this will generate and run a verification script."
- **Respect the user's decision**: if they decline, move on. The features are tools, not requirements.
