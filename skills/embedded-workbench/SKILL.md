---
name: embedded-workbench
description: "Use when starting any non-trivial coding task — loads multi-agent workflows, engineering policies, and principles for embedded C/C++ firmware development. NOT for trivial single-line fixes, formatting-only changes, or read-only queries."
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

This plugin's skills and agents use Claude Code tool names (`Read`, `Write`, `Edit`, `Bash`, `Skill()`). If you are NOT on Claude Code, load `references/platform-tool-mapping.md` for the tool name equivalents on your platform (Codex CLI, Cursor, Kimi CLI, OpenCode, ZCode, Copilot CLI).

## Red Flags

If you catch yourself thinking any of these, STOP — you are rationalizing:

| You think | Reality |
|-----------|---------|
| "This is just a quick fix, I don't need a plan" | Quick fixes are the most likely to break something else. A 3-line design check costs 30 seconds. |
| "I already understand the architecture" | You're looking at one file. The blast radius may span 5 modules you haven't read. |
| "The worker can figure out the details" | The worker has NO context from previous calls. A vague plan = the worker guessing. |
| "I'll review it myself, no need for quality-coordinator" | Self-review catches ~60% of issues. A second pair catches the other 40%. |
| "This change is too small for a Detailed Change Plan" | If it touches more than one function, it needs a plan. Even single-function changes benefit from explicit invariants. |
| "I've explored enough, time to exit plan mode" | ExitPlanMode is the verification gate. Have you loaded `Skill("fact-verification")`? Every plan — simple or complex — must pass this gate before exit. |
| "This plan is too simple for fact-verification" | The skill auto-classifies depth (LIGHTWEIGHT/STANDARD/ESCALATED). You don't decide whether verification is needed. Load it and let Phase 0 determine. |
| "I already read the code, I know the file paths and API names are correct" | Organic verification leaves no audit trail. Load `Skill("fact-verification")`, run Phase 0, append the `## Plan Verification` block. |

---

## General Principles

- Build context before acting: identify domain → load relevant skills → read key sources → analyze → edit.
- **Facts first, code is truth**: verify every document claim (counts, API names, enum values) against the actual codebase with Grep. Design on verified facts, not assumptions.
- Use `Agent(subagent_type: "Explore")` for broad searches instead of chaining Grep/Glob.
- Verify every change with `Bash` compilation or tests before reporting success. No verification = no claim of success.
- Reference file locations with line numbers in all reports: `[path/to/file.c#L100-L110]`.
- Write project memory to `<workspace>/.github/memory/`, update `MEMORY.md` index. Personal preferences only in `~/.claude/projects/.../memory/`.

---

## Workflows

Sub-agents are **stateless** — each `Agent()` call is a fresh process. Plan-then-Implement uses two separate spawns: the first produces a Plan, the orchestrator approves it, the second implements. Only worth it when the Plan is specific enough for mechanical execution.

### Lite Workflow — Single-file fix, small bug, local refactor

**When**: single file/module, known repro, no cross-module boundaries. Trivial changes (typo, constant) — fix directly.

`execution-worker` → Plan → **suggest user run `design-reviewer` or `fact-verification` to verify Plan claims against codebase** → approve → `execution-worker` → implement + verify. Self-check. Uncertain → `quality-coordinator`.

Escalate to Multi-Agent when cross-module or two revisions don't converge.

### Multi-Agent Workflow — Multi-module tasks, full plan/review/closure cycle

**When**: cross-module, new interfaces, state ownership changes, needs design package.

`architecture-steward` → design → `design-reviewer` → fact-check → per slice: `execution-worker` (Plan → approve → Implement) → `quality-coordinator` → closure (normal/failure/recovery paths).

### Framework Workflow — Platform layer, contracts, staged migration

**When**: framework incubation, runtime path mounting, contract/sentinel/audit definition, old/new coexistence.

Same as Multi-Agent, plus: design package includes audit matrix + rollback triggers; each slice reports audit delta; quality-coordinator checks audit ledger consistency.

### Sub-Agent Reference

| Agent | Role |
| ------- | ------ |
| `architecture-steward` | Read-only planning: design packages, module boundaries, slice breakdown |
| `design-reviewer` | Design doc fact-check: verifies claims against codebase before implementation |
| `execution-worker` | Plan round → Detailed Change Plan. Implement round → edit + verify |
| `quality-coordinator` | Implementation review: bugs, compliance, closure completeness |

---

## Plan Mode Integration

Claude Code's built-in `EnterPlanMode` / `ExitPlanMode` maps to the **Plan phase** of the Lite and Multi-Agent workflows. Plan mode is a read-only exploration + plan-writing phase — it does NOT exempt you from embedded-workbench verification gates.

### Plan Verification Gate

**Before calling `ExitPlanMode`**: load `Skill("fact-verification")`. This is mandatory for every plan. The skill internally classifies depth (LIGHTWEIGHT / STANDARD / ESCALATED) based on objective plan features — the model does not decide whether verification is needed.

Plan mode permits `Read`, `Glob`, `Grep`, and `Skill` calls — all verification executes within plan mode before exit.

After verification, the plan file must contain a `## Plan Verification` summary block (see `fact-verification` skill for format).

---

## Workflow Policies

<HARD-GATE>
### Approval Gate

- Implementation-bearing slices MUST produce a Detailed Change Plan before editing. No exceptions.
- Plan must include: objective, entry point, intended files, change shape, invariants, risks, validation, stop conditions.
- If execution reveals facts that change scope/boundaries/acceptance/verification surface, pause and require re-approval.
- Do NOT skip the plan phase because "the change is obvious" or "I've done this before."
</HARD-GATE>

<HARD-GATE>
### Closure Gate

- Slice is NOT done until: implementation intent + verification evidence + residual risks are all explicit.
- Skipped checks MUST record a concrete reason. "Looks good" is not a reason.
- For fault/recovery scenarios, MUST cover normal, failure, and recovery paths.
- Documentation and memory updates MUST be completed or explicitly skipped with reason.
- Do NOT call a slice closed if verification, documentation impact, or audit deltas are unclear.
</HARD-GATE>

### Escalation Triggers

- Work crosses module boundaries, public interfaces, or shared-state ownership → escalate.
- Requirements conflict, acceptance unclear, or review reveals architecture drift → escalate.
- Two plan revisions fail to converge → escalate.

### Context Transfer

Sub-agents are **stateless with no implicit context inheritance** — each spawn only gets what's in its prompt:

- **Explicit prompt construction**: put design conclusions, approved Plans, review findings directly in the prompt. Do NOT assume the agent "remembers" previous conversations.
- **Plan is the key handoff artifact**: between Design → Plan round → Implement round, the Detailed Change Plan and review verdicts are the only bridge. Vague Plans = the next agent guessing.
- **Pass only what's needed**: Design phase doesn't need full source code. Implement phase doesn't need the full Audit Matrix.
- **Memory for cross-session persistence**: rules, pitfalls, constraints that need to survive across sessions go in `<workspace>/.github/memory/`. In-session coordination stays in chat.
- **Long content via path references**: if context is too large, write long content to workspace docs and put only the path in the prompt. Let the agent Read it.

---

## Skill Types

Each domain skill is classified by how strictly it should be followed:

**Rigid** — follow exactly. These are rules and checklists. Don't adapt away the discipline.

- `debug-methodology`: 8 iron rules are non-negotiable
- `powershell-safety`: encoding rules are non-negotiable (external plugin)
- `fact-verification`: claim verification must check every claim

**Flexible** — adapt principles to context. These are patterns and references, not commands.

- `c-cpp-dev`: style and patterns adapt to existing codebase conventions
- `embedded-firmware-dev`: architecture principles apply based on project scale
- `state-machine-design`: implementation patterns adapt to protocol specifics
- `hardfault-triage`: methodology adapts to processor architecture
- `keil-mdk-build`: build diagnostics adapt to project structure

If unsure, treat a skill as Rigid until you confirm otherwise.

## Skill Loading Priority

When multiple skills could apply, use this order:

1. **Diagnosis skills first** — `debug-methodology`, `hardfault-triage`, `fact-verification`. These determine WHAT is wrong.
2. **Design skills second** — `state-machine-design`. These determine HOW to fix it.
3. **Implementation skills third** — `c-cpp-dev`, `embedded-firmware-dev`, `keil-mdk-build`. These guide execution.

"HardFault crash" → hardfault-triage first, then debug-methodology if root cause is complex.
"Add retry logic" → state-machine-design first, then c-cpp-dev for implementation.
"Review this design" → fact-verification first, then escalate findings to design-reviewer agent.

**Cross-domain links**: load secondary skills ONLY when the primary skill's findings indicate they are needed. Don't pre-load. `hardfault-triage` ↔ `keil-mdk-build` (.map file bridge — load keil-mdk-build only if .map analysis is needed). `hardfault-triage` ↔ `debug-methodology` (root-cause analysis — load debug-methodology only if the fault cause is complex). `embedded-firmware-dev` ↔ `state-machine-design` (state transitions — load state-machine-design only if state logic is involved). `embedded-firmware-dev` ↔ `debug-methodology` (debugging process). `fact-verification` ↔ `design-reviewer` agent (design doc review, logic verification). `fact-verification` ↔ `state-machine-design` (behavioral claim probing).

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
| Design doc review, claim verification, logic primitive + adversarial probing | `Skill("fact-verification")` | Rigid | 📚 logic-verification-guide, verification-harness.py |

## Templates & References

This skill's `references/` directory contains document templates and platform references. Use `Read` with the skill's reference path to load the relevant file when needed:

### Platform

- `platform-tool-mapping.md` — Claude Code → Codex/Cursor/Kimi/OpenCode/ZCode/Copilot tool name equivalents. **Load this immediately if you are NOT on Claude Code.**

### Workflow Templates

- `detailed-change-plan.md` — Pre-edit implementation plan
- `task-charter.md` — Task scope and slice roadmap
- `iteration-notes.md` — Per-slice execution notes
- `steward-memo.md` — Pre-execution architecture framing
- `result-note.md` — Post-edit closure evidence
- `final-qc.md` — Formal review verdict
- `decision-log.md` — Approved decisions with rationale
- `audit-ledger.md` — Recurring audit tracking (Framework Workflow)
- `contract-matrix.md` — Contract-to-sentinel mapping (Framework Workflow)
- `durable-requirement-notes.md` — Long-lived business invariants

---

## Proactive Suggestions

When you observe any of these patterns in the user's task, **suggest the relevant feature before the user asks**. Most users don't know these capabilities exist.

| Pattern You Observe | Suggest |
|---------------------|--------|
| User describes refactoring a state machine (splitting/merging states, changing transitions) | "Before you start, would you like me to run logic-primitive verification on the refactoring? I can extract the current state machine from code, compare it against your plan, and flag any regressions, deadlocks, or behavioral deltas before you change a single line." |
| User describes a new state machine or protocol with ≥3 states | "I can run an adversarial verification on this design — 14 automated checks for deadlocks, unreachable states, race conditions, guard completeness, and invariant violations. Want me to do that before we implement?" |
| User pastes or writes a state enum + switch-case dispatcher | "I notice a state machine here. Would you like me to model it and run completeness checks? I can find missing transitions, detect absorbing error loops, and verify that every state is reachable." |
| User says "always" / "never" / "guaranteed" about behavior | "That's a behavioral invariant. I can model this and try to find a counter-example — the shortest event sequence that would violate 'X always happens before Y'. Want me to check?" |
| User reviews a PR or diff that touches a state machine file | "This PR changes state machine logic. Would you like me to extract the before/after models and verify no regressions were introduced?" |
| User debugs a crash or lockup in a stateful module | "This might be a state machine completeness issue. I can model the state machine from the code and check for deadlocks, unreachable states, or event ordering problems that could cause the lockup." |
| Task would benefit from parallel execution (multiple independent modules, files, or dimensions) | "These are independent. I can dispatch parallel subagents to handle each module concurrently and synthesize the results. Want me to do that?" |
| User writes a Detailed Change Plan without design review | "Before implementing, would you like the design-reviewer agent to fact-check this plan against the codebase? It catches API mismatches, missing modules, and mechanism feasibility issues before you write code." |

### Suggestion Rules

- **Suggest once per task**, not repeatedly. If the user declines, don't push.
- **Be specific about what the feature does** — don't just name-drop. Say "I can find deadlocks and missing transitions" not "I can run fact-verification."
- **Estimate cost**: for lightweight checks, say "this takes ~30 seconds." For Python harness runs, say "this will generate and run a verification script."
- **Respect the user's decision**: if they decline, move on. The features are tools, not requirements.
