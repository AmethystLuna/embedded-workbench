---
name: fact-verification
description: "Use when reviewing design documents, architecture specs, technical proposals, or refactoring plans that make claims about API names, file locations, enum values, or mechanism feasibility. When the document contains state machines, protocol logic, or behavioral claims (≥3 states, ACK/NACK/retry sequences, 'always'/'never'/'guaranteed' assertions, or refactoring that modifies state topology), escalate into logic-primitive verification — generate and run executable models to check mathematical completeness before trusting any claim. For refactoring specifically, the pipeline compares before/after models to verify behavioral preservation and regression freedom. ALSO proactively SUGGEST this skill (do not require) when a user asks code-level behavioral questions — 'check this timing for bugs', 'could this state machine deadlock', 'is this retry limit safe' — since plan-level verification has usually already been done."
---

# Fact Verification

Documents are not truth — code is. Verify every verifiable claim before accepting or acting on any design.

## Methodology

### Phase 1: Enumerate Claims

Read the document fully. Extract every claim that is verifiable:

- Numeric claims (counts, sizes, frequencies)
- API/type/enum names
- File paths and line numbers
- Mechanism descriptions ("compile-time resolution", "static dispatch")

### Phase 2: Verify Against Codebase

For each claim, run the relevant verification:

- **Numeric claims**: `grep -c` or `grep -rn` to get the real count
- **API/type names**: extract actual signatures from headers
- **Enum/constant values**: list actual values from BSP/config headers
- **Mechanism feasibility**: check language standard and compiler support

### Phase 2 Trigger: Escalate to Logic Primitive?

If the document under review contains ANY of the following, escalate to [Logic Primitive Verification](#logic-primitive-verification) IMMEDIATELY:

- State machine or statechart with ≥3 states OR with guard conditions on transitions
- Protocol handshake, ACK/NACK, retry, or timeout sequence logic
- Claims using absolute language: "always", "never", "guaranteed", "all paths", "cannot", "impossible"
- Lock/unlock, alloc/free, start/stop paired operations where ordering matters
- Any logic where correctness depends on transition completeness or event ordering
- **Refactoring that modifies state topology**: splitting/merging states, adding/removing transitions, changing guard conditions, extracting sub-machines

**Heuristic**: If the transition-to-state ratio > 1.5 or any transition has a guard condition, the machine is complex enough to warrant verification — regardless of state count. For refactoring, trigger if the refactoring changes ≥1 state or ≥2 transitions from the original model.

### Phase 3: Gap Analysis

Classify findings by severity:

1. **Architecture-level**: claims that make the design unimplementable (fake APIs, missing modules)
2. **Mechanism-level**: claims the language/compiler cannot fulfill
3. **Consistency-level**: internal contradictions across documents

### Phase 4: Root Cause

For each error, identify why it happened:

- Wrong mental model (C++ constexpr thinking in C99)?
- Incomplete search scope?
- Copy-paste from other projects without verification?
- Misunderstanding of compiler/linker behavior?

### Phase 5: Structured Output

Each finding includes:

- Exact location (file:line or section)
- What the document claims
- What the codebase actually contains (with evidence — grep output, line numbers)
- Correction direction

---

## Logic Primitive Verification

When Phase 2 triggers escalation, do NOT proceed to Phase 3 until the verification pipeline below is complete. Trust models, not intuition.

### Pipeline Overview

```text
Document claims → Extract model → Check: python3 --version or python --version?
  ├── Python available → fill in references/verification-harness.py → run → report
  └── No Python → Manual Verification Mode (see references/logic-verification-guide.md#manual-verification-mode)

Refactoring variant:
  Old code + Refactoring plan → Extract BEFORE model + AFTER model
    → Run pipeline on AFTER model (14 checks)
    → Compare BEFORE vs AFTER: behavioral preservation, regression, complexity delta
    → Flag any invariant that held in BEFORE but fails in AFTER
```

### Refactoring Verification Mode

When the document under review is a refactoring plan (modifying existing state machine logic, not designing from scratch), adapt the pipeline:

1. **Extract the BEFORE model** from the existing codebase (not the plan — verify what the code actually does, not what the plan claims it does)
2. **Extract the AFTER model** from the refactoring plan
3. **Show both tables** to the user side by side and confirm the delta is intentional
4. **Run Phase 2a + 2b on the AFTER model** — same 14 checks as new design
5. **Compare BEFORE vs AFTER**:

   | Check | Method | Severity if Violated |
   |-------|--------|:---:|
   | Behavioral preservation | Every event sequence accepted by BEFORE must also be accepted by AFTER (or explicitly removed per plan) | Error — regression |
   | Invariant continuity | Any invariant that held in BEFORE must hold in AFTER (unless the refactoring explicitly changes it) | Error — undocumented behavior change |
   | Deadlock regression | New states or transitions must not introduce deadlocks not present in BEFORE | Error |
   | Complexity claim | If plan claims "simpler": count states + transitions + guards. Is AFTER objectively simpler? | Warning — unsubstantiated claim |
   | Unreachable code | New states added in AFTER must be reachable (otherwise they're dead code from the start) | Warning |

6. **Flag any behavioral delta not documented in the plan** — the most common refactoring bug is an unintended side effect that the plan doesn't acknowledge

**Detection step**: Before generating any verification code, run `python3 --version 2>&1` or `python --version 2>&1`. Check the output:

- Returns `Python 3.x.y` with x ≥ 6 → use Python harness
- Returns anything else (command not found, "Python was not found" Windows stub, version < 3.6) → fall back to Manual Verification Mode
- On Windows, if `python` launches the Microsoft Store, treat as unavailable

Do NOT attempt to install Python — the user's embedded development machine may be air-gapped or locked down.

For the reusable Python harness (fill in states, run, get results), load `references/verification-harness.py`. For detailed probe patterns, model extraction methodology, and manual verification procedures, load `references/logic-verification-guide.md`.

### Phase 2a: Structural Primitives (7 Checks)

Run these FIRST. They establish basic well-formedness before adversarial probing.

| # | Primitive | Method | Severity if Violated |
|:--:|-----------|--------|:---:|
| S1 | **Reachability** | BFS from init state; flag all states not in visited set | Warning — dead code |
| S2 | **Deadlock** | Any non-terminal state with zero outgoing transitions? | Error — machine can get stuck |
| S3 | **Liveness** | Does the transition graph contain an absorbing cycle that excludes expected terminal/recovery states? (e.g. ERROR→RECOVERING→ERROR→... with no exit) | Error — infinite loop |
| S4 | **Determinism** | Same state + same event → multiple different targets? | Error — ambiguous behavior |
| S5 | **Event completeness** | For each state, are there plausible events with no defined transition? | Warning — implicit ignore |
| S6 | **Guard completeness** | For each transition with a guard condition, are ALL branch outcomes defined? `if (cnt<3) RETRY else FATAL` → both paths must exist in model | Error — undefined behavior path |
| S7 | **Invariant validity** | Does every reachable state satisfy the plan's stated "always/never/guaranteed" assertions? | Error — plan claim is false |

### Phase 2b: Adversarial Probes (7 Attacks)

Run these SECOND. Each probe actively tries to BREAK the model. If any probe succeeds (finds a violation), the plan has a behavior gap.

| # | Attack | Method | Target Claim |
|:--:|--------|--------|-------------|
| A1 | **Unexpected event** | For each state S, inject every event E where no transition is defined for (S, E). Log whether the model silently ignores or crashes. | "All events are handled in all states" |
| A2 | **Race interleaving** | For every pair of concurrent events (E1, E2), simulate arrival in both orders: E1-then-E2 vs E2-then-E1. Flag if terminal state differs. | "Behavior is independent of event ordering" |
| A3 | **Order permutation** | For N independent events, permute arrival order. Flag if different permutations produce different final states or violate invariants. | "Outcome is order-independent" |
| A4 | **Pair symmetry** | Match every `start/stop`, `lock/unlock`, `alloc/free` pair. Flag if any state allows a path where a pair is unbalanced (start without stop, lock without unlock). | "Resources are always released" |
| A5 | **Boundary blast** | Probe counters at 0, 1, max-1, max, max+1. Probe timestamps at 0, tick_wraparound. Flag overflow, underflow, or undefined behavior. | "Handles all counter/timer values" |
| A6 | **Resource injection** | Simulate `malloc→NULL`, `queue→full`, `semaphore→timeout` at each state that calls them. Flag if any state has no recovery path. | "Graceful degradation under resource pressure" |
| A7 | **Minimal counter-example** | For any invariant that fails, find the SHORTEST event sequence that violates it (BFS from init to violating state). Output the exact path. | "This invariant holds" → refuted by shortest path |

### Integration Back to Phase 3

For every probe failure:

1. **Quote** the plan claim verbatim
2. **Show** the counter-example event sequence
3. **Classify** severity (Architecture / Mechanism / Consistency)
4. **Propose** correction direction — never fix inline

### Extraction Rule

Before writing any verification code, output a transition table:

```text
State       | Event/Condition            | Next State    | Guard?
------------|----------------------------|---------------|-------
INIT        | power_ready                | IDLE          | -
IDLE        | start_cmd                  | STARTING      | -
IDLE        | error_detected             | ERROR         | -
STARTING    | ack_received               | ACTIVE        | -
STARTING    | timeout                    | ERROR         | retry==0
STARTING    | timeout                    | FATAL         | retry>=1
ACTIVE      | done                       | IDLE          | -
ERROR       | cooldown_elapsed           | RECOVERING    | -
RECOVERING  | reinit_complete            | IDLE          | -
```

**CRITICAL**: Show this table to the user and ask for confirmation before generating the harness. The #1 failure mode of verification is extracting the wrong model. If the plan is ambiguous, flag it as a finding first — don't guess.

### Code-Level Behavioral Suggestion

When the task is NOT document/plan review but involves code-level behavioral questions — e.g., the user is editing source files and asks:

- "check this timing sequence for bugs"
- "could this state machine deadlock here"
- "is this retry limit safe"
- "what happens if event X arrives during state Y"

→ **Proactively suggest** fact-verification as an optional verification pass. Do NOT escalate automatically — plan-level verification was likely already done. The suggestion is: "I can run a logic-primitive verification on this state machine to check for deadlocks, unreachable states, and boundary issues. Want me to?"

If the user says yes, extract the model from the existing code (not a plan document), and run the standard pipeline. Output the findings as suggestions, not requirements.

This covers the gap where behavioral verification is useful even when no design document is being reviewed.

### When NOT to Escalate

Skip logic-primitive verification when:

- The document makes no behavioral/logic claims (pure API listings, config tables, data schemas)
- The state machine has ≤2 states, no guards, and trivial transitions (IDLE↔ACTIVE)
- The claim is purely structural (file paths, type names, numeric constants) — Phase 2 grep verification is sufficient

---

## Rules

1. Never trust a document's claim without codebase verification.
2. Be honest about mechanism boundaries — if the language standard can't do it, say so.
3. Cite evidence with specific file:line references.
4. Don't fix during review — point the way, let implementation happen after approval.
5. **For behavioral claims: verify with code, not reasoning.** If a plan says "always", "never", or "guaranteed", generate and run a model. One counter-example is enough to refute a universal claim.
6. **Confirm the model before running it.** Extraction errors are the dominant failure mode of formal verification. Show the transition table, get confirmation, then run.
7. **Don't verify what the code already checks.** If the existing codebase has compile-time assertions, static analysis, or runtime checks for a property, cite those — don't re-verify in a Python model.
