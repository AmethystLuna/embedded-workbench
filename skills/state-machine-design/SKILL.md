---
name: state-machine-design
description: "Use when reviewing or fixing async protocols, retries, ACK/NACK handling, pending flags, timeout logic, or state-machine lockups in embedded firmware."
---

# State Machine Design

## Core Rules

- Fix the state model, not the symptom. Every in-progress or pending flag must have explicit success, failure, timeout, and reset exits.
- Timeout logic must be gated on real pending work. Idle states must not trigger retry, recovery, or error transitions.
- Do not trust a low-level send return value as proof of delivery when an application-layer ACK exists. Use the protocol's completion signal.
- When adding retries, also define attempt timestamps, backoff rules, and cleanup paths so the state machine cannot lock up silently.
- If pause, stop, or reconnect can interrupt the normal flow, add an explicit recovery or re-drive branch instead of assuming the old path will naturally resume.

## Transition Gates

- When a state transition depends on multiple preconditions, verify every one explicitly at the transition gate. Do not rely on implicit assumptions (e.g., "the timer expired, therefore everything must be healthy"). A single unchecked precondition is the most common source of silent state corruption.
- If a target state's preconditions can become false while already in that state, define a reverse transition back to the source state. One-way state latches without fallback paths will eventually leak incorrect state to downstream consumers.

## Transient Tolerance

- Distinguish between genuine state-changing events and transient perturbations during mode switches, direction reversals, or re-initialization windows. The latter need a tolerance or grace window; only the former should advance the state machine or increment error counters.

## When To Escalate

- When diagnostics point to an architecture-level or state-machine design defect, proactively offer high-level remediation focused on boundary clarity, lifecycle contracts, and reversible transitions — don't just propose ad-hoc runtime patches.

**REQUIRED SUB-SKILL:** If you find a state machine bug, also load `Skill("debug-methodology")` to apply structured root-cause analysis. If the bug involves async lifecycle flags or hardware events, load `Skill("embedded-firmware-dev")`.
