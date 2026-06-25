---
name: embedded-workbench
description: "Use when starting any non-trivial coding task — loads multi-agent workflows, engineering policies, and principles for embedded C/C++ firmware development."
---

# Embedded Engineering Workflow

Core workflow system and engineering principles.

## Red Flags

If you catch yourself thinking any of these, STOP — you are rationalizing:

| You think | Reality |
|-----------|---------|
| "This is just a quick fix, I don't need a plan" | Quick fixes are the most likely to break something else. A 3-line design check costs 30 seconds. |
| "I already understand the architecture" | You're looking at one file. The blast radius may span 5 modules you haven't read. |
| "The worker can figure out the details" | The worker has NO context from previous calls. A vague plan = the worker guessing. |
| "I'll review it myself, no need for quality-coordinator" | Self-review catches ~60% of issues. A second pair catches the other 40%. |
| "This change is too small for a Detailed Change Plan" | If it touches more than one function, it needs a plan. Even single-function changes benefit from explicit invariants. |

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

## Domain Skills

Load domain-specific guidance when the task matches. Skills marked with 📚 have deep reference material in their `references/` directory.

| Task | Skill | Deep Refs |
|------|-------|:---------:|
| Debugging crashes, HardFault, logs | `Skill("debug-methodology")` | 📚 case study |
| HardFault / exception triage, fault registers, .map crash resolution | `Skill("hardfault-triage")` | — |
| C/C++ code generation or style | `Skill("c-cpp-dev")` | — |
| FreeRTOS, ISR, NVM storage, sensor drivers | `Skill("embedded-firmware-dev")` | 📚 architecture, patterns, LVGL |
| Keil MDK, ARMCLANG, build system, .map optimization | `Skill("keil-mdk-build")` | — |
| State machines, retries, timeouts | `Skill("state-machine-design")` | — |
| Design doc review, claim verification | `Skill("fact-verification")` | — |

**Cross-domain links**: `hardfault-triage` ↔ `keil-mdk-build` (.map file bridge). `hardfault-triage` ↔ `debug-methodology` (root-cause analysis). `embedded-firmware-dev` ↔ `state-machine-design` (state transitions). `embedded-firmware-dev` ↔ `debug-methodology` (debugging process). `fact-verification` ↔ `design-reviewer` agent (design doc review).

## Templates

This skill's `references/` directory contains document templates. Use `Read` with the skill's reference path to load the relevant template when producing workflow artifacts:

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
