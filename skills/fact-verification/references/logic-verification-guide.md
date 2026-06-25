# Logic Verification Guide

Deep reference for Phase 2a/2b of fact-verification. Load this when the skill triggers escalation to logic-primitive verification. Covers model extraction methodology, probe design patterns, counter-example interpretation, and known limitations.

## Model Extraction Methodology

### Step 1: Identify the State Machine Boundary

Before extracting states, determine what IS and IS NOT part of the machine:

- **In**: states the plan explicitly names, events the plan describes, guards the plan states
- **Out**: hardware-level behavior (register writes, DMA transfers), OS-level scheduling (task switches, priority inversion), external system interactions not described in the plan

If the plan doesn't clearly define the boundary, flag it: "Plan does not define state machine scope — model may be incomplete."

### Step 2: Extract States

Scan the plan for:

- Enumerated state types (`typedef enum { ... } xxx_state_t`)
- Named phases in prose ("the system then enters the RECOVERING phase")
- Implicit states (error paths described but not named — give them explicit names in the model)

**Rule**: If a behavioral section describes a distinct set of actions before a transition, it's a state — even if the plan doesn't label it as one.

### Step 3: Extract Transitions

For each state, list:

- **Explicit transitions**: `state = NEXT_STATE` assignments, `→` arrows in diagrams, prose like "then transitions to X"
- **Guard conditions**: `if/else` branches that split a single event into multiple next states
- **Timer-driven transitions**: timeouts, retry delays, cooldown periods

**Edge case**: A transition mentioned in prose but missing from the state diagram. Flag it — "Plan describes transition X but state diagram omits it."

### Step 4: Identify Invariants

Extract every claim that uses absolute language:

| Pattern | Example | Invariant to Check |
|---------|---------|-------------------|
| "always ..." | "always returns to IDLE" | From every state reachable in ≤K steps, IDLE is reachable |
| "never ..." | "never enters ACTIVE without power_ready" | ACTIVE is not reachable from any path that hasn't passed through power_ready |
| "guaranteed ..." | "guaranteed cleanup within 500ms" | Every ERROR→RECOVERING path includes a cooldown transition |
| "cannot ..." | "cannot deadlock" | No absorbing cycle exists |
| "all paths ..." | "all paths lead to ERROR on failure" | Every failure event reaches ERROR (not FATAL, not stuck) |

### Step 5: Confirm with User

Show the extracted transition table BEFORE writing the harness. Ask:

1. Are all states captured?
2. Are all transitions and guards correct?
3. Are there undocumented transitions not in the plan?
4. Is the initial state correct?

Only proceed after confirmation. A wrong model produces wrong counter-examples, which wastes more time than no verification at all.

## Probe Design Patterns

### A1: Unexpected Event Injection

```python
# For each state S, list all events defined anywhere in the machine
# For each event E not handled by S, test: what happens?
def unexpected_event_probe(states):
    all_events = set()
    for trans in states.values():
        all_events.update(trans.keys())
    
    findings = []
    for state, transitions in states.items():
        unhandled = all_events - set(transitions.keys())
        if unhandled:
            findings.append({
                "state": state,
                "unhandled_events": list(unhandled),
                "risk": "Silent ignore or undefined behavior"
            })
    return findings
```

### A2: Race Interleaving

For pairs of events that can arrive within the same tick (e.g., timer expiry + message reception):

```python
def race_interleaving(states, init, event_pairs):
    # event_pairs = [("timeout", "ack"), ("error", "done"), ...]
    findings = []
    for e1, e2 in event_pairs:
        # Path 1: e1 then e2
        s1 = step(init, [e1, e2])
        # Path 2: e2 then e1
        s2 = step(init, [e2, e1])
        if s1 != s2:
            findings.append({
                "events": (e1, e2),
                "order_e1_e2_ends_in": s1,
                "order_e2_e1_ends_in": s2,
                "risk": "Order-dependent outcome not documented"
            })
    return findings
```

### A3: Order Permutation

Extends A2 to N events. For small N (≤5), do full permutation. For larger N, sample:

```python
from itertools import permutations

def order_permutation_probe(states, init, events, invariant_check=None):
    findings = []
    terminals = set()
    for perm in permutations(events):
        final = step(init, list(perm))
        terminals.add(final)
        if invariant_check and not invariant_check(final):
            findings.append({
                "sequence": list(perm),
                "final_state": final,
                "violates": "invariant"
            })
    if len(terminals) > 1:
        findings.append({
            "terminal_states": list(terminals),
            "risk": f"Same events produce {len(terminals)} different outcomes depending on order"
        })
    return findings
```

### A4: Pair Symmetry

```python
# Define paired operations
PAIRS = [
    ("lock", "unlock"),
    ("start", "stop"),
    ("alloc", "free"),
    ("enable_irq", "disable_irq"),
    ("open", "close"),
]

def pair_symmetry_probe(states, init):
    findings = []
    for acquire, release in PAIRS:
        if acquire not in all_events(states) and release not in all_events(states):
            continue  # This pair type is not used
        # DFS from init: every path that calls acquire must eventually call release
        # before reaching a terminal state (or acquire again)
        unbalanced = find_unbalanced_paths(states, init, acquire, release)
        if unbalanced:
            findings.append({
                "pair": (acquire, release),
                "unbalanced_paths": unbalanced,
                "risk": "Resource leak or deadlock"
            })
    return findings
```

### A5: Boundary Blast

```python
def boundary_blast(counters, timestamps):
    findings = []
    for name, val in counters.items():
        test_values = [0, 1, val-1, val, val+1, 2**32-1, 2**32]
        for tv in test_values:
            if tv < 0 or tv > val:
                findings.append({
                    "variable": name,
                    "value": tv,
                    "risk": f"Counter overflow/underflow at {tv} (max defined: {val})"
                })
    # Timestamp wraparound (millis() / sys_tick())
    # On 32-bit ARM: wraparound at ~49.7 days for 1ms tick
    for name, val in timestamps.items():
        findings.append({
            "variable": name,
            "risk": f"Timestamp wraparound not handled — check elapsed_ms() / elapsed_ticks() pattern"
        })
    return findings
```

### A6: Resource Injection

```python
RESOURCE_FAILURES = {
    "malloc": "returns NULL",
    "queue_send": "queue full",
    "semaphore_take": "timeout",
    "message_alloc": "pool exhausted",
}

def resource_injection_probe(states):
    findings = []
    for state, transitions in states.items():
        for event in transitions:
            for resource, failure in RESOURCE_FAILURES.items():
                if resource in event.lower() or resource in state.lower():
                    # Simulate: what if this resource call fails in this state?
                    # Does the machine have a recovery transition?
                    has_recovery = any(
                        "error" in t.lower() or "fail" in t.lower() or "retry" in t.lower()
                        for t in transitions.values()
                    )
                    if not has_recovery:
                        findings.append({
                            "state": state,
                            "resource": resource,
                            "failure_mode": failure,
                            "risk": f"No recovery path if {resource} {failure} in state {state}"
                        })
    return findings
```

### A7: Minimal Counter-Example

```python
from collections import deque

def shortest_violating_path(states, init, invariant_check):
    """BFS to find the shortest event sequence that violates an invariant."""
    queue = deque([(init, [])])
    visited = set()
    while queue:
        state, path = queue.popleft()
        if state in visited:
            continue
        visited.add(state)
        
        if not invariant_check(state):
            return path  # Shortest violating path found
        
        for event, next_state in states.get(state, {}).items():
            queue.append((next_state, path + [event]))
    
    return None  # Invariant holds for all reachable states
```

## Counter-Example Interpretation

When a probe finds a counter-example, classify it:

### True Positive (plan has a real gap)

- The counter-example uses only events/states defined in the plan
- The plan's own rules would agree this is a violation
- **Action**: Report as a finding with severity based on impact

### Model Error (extraction was wrong)

- The counter-example depends on a transition the plan doesn't actually define
- The plan explicitly handles this case but the model extraction missed it
- **Action**: Fix the model and re-run; do NOT report as a finding

### Acceptable Risk (gap is intentional)

- The plan acknowledges the gap explicitly ("not handled, system resets")
- The counter-example requires physically impossible event sequences
- **Action**: Note in findings but mark as "acknowledged — no fix needed"

## Known Limitations

### What This Method CAN Detect

- Missing transitions and states
- Deadlock and livelock
- Violated invariants (the plan's own claims disproven)
- Race conditions between documented events
- Unsymmetrical resource pairs
- Counter/timer boundary issues

### What This Method CANNOT Detect

- **Implementation bugs**: The C code may have errors not present in the model
- **Timing-dependent bugs**: Python model does not simulate real-time constraints
- **Compiler/optimization issues**: Volatile omission, reordering, inlining effects
- **Hardware-specific behavior**: Memory-mapped I/O timing, DMA races, cache coherency
- **Undocumented behavior**: If the plan doesn't describe a transition, the model can't either
- **Real concurrency**: The model is single-threaded; true preemptive multitasking bugs are out of scope
- **Entry/exit actions**: State entry/exit side effects (e.g., `lock()` on enter, `unlock()` on exit) are not modeled as events. A4 Pair Symmetry may miss unbalanced pairs that exist only in entry/exit actions. If the plan describes these, manually extract them as pseudo-events (`ENTER_state`, `EXIT_state`) before running verification.
- **Guard variable scope**: The model treats guard variables as global to the machine. If a guard variable's lifetime is state-scoped (reset on entry) but the model assumes it accumulates globally, boundary-blast results will be wrong. Verify guard variable scope during extraction.
- **Nested/hierarchical states (Harel statecharts)**: The model only supports flat state machines. Parent/child state nesting, history pseudostates, and orthogonal regions are not supported — flatten them manually before verification.
- **Cross-machine protocols**: Two interacting state machines are verified independently. Composition bugs (e.g., Machine A sends event E to Machine B, but B is in a state that doesn't handle E) are invisible to single-machine verification. If the plan describes multi-machine interaction, document the protocol contract separately.

### Model Fidelity Warning

The Python model is an APPROXIMATION. It models state transitions, not execution semantics. A model that passes all 14 checks means the plan's LOGIC is consistent — NOT that the implementation will work. Always follow logic verification with code-level review.

## Refactoring Verification

When the document is a refactoring plan (modifying existing logic, not greenfield design), the pipeline adapts to compare BEFORE and AFTER models.

### Extraction for Refactoring

The BEFORE model comes from **code, not the plan**. The plan may describe the current state inaccurately — verify against the actual implementation:

1. Read the relevant source files (state machine dispatch, state enum, handler functions)
2. Extract the ACTUAL transition logic from code, not from the plan's description of "current behavior"
3. Extract the AFTER model from the plan as usual
4. Display both tables side by side

### Comparison Methodology

**Behavioral preservation**: For each event sequence accepted by BEFORE, trace the same sequence in AFTER. If AFTER ends in a different state (or rejects the sequence), flag as BEHAVIORAL DELTA. The plan must explicitly document this delta — if it doesn't, it's a regression.

**Invariant continuity**: Re-run S7 invariant checks on both models. Any invariant that passes on BEFORE but fails on AFTER is a regression — the refactoring broke an existing guarantee.

**Complexity delta**: Count objectively:

- Number of states (BEFORE vs AFTER)
- Number of transitions
- Number of guard conditions
- Maximum path length from INIT to any terminal state

If the plan claims "simplification" but the numbers don't decrease, flag as UNSUBSTANTIATED CLAIM.

**Deadlock regression**: A refactoring that splits one state into two should not introduce a deadlock path that didn't exist before. Run S2 on AFTER and compare to BEFORE's deadlock report.

### Common Refactoring Bugs Caught by This Method

- **State split introduces dead edge**: Splitting ERROR into ERROR_TRANSIENT and ERROR_PERMANENT creates a new state with no transition from ERROR_TRANSIENT back to RECOVERING
- **Guard inversion**: Changing `retry < 3` to `retry <= 3` silently adds one more retry — the plan doesn't mention it
- **Orphaned event**: A transition removed in the refactoring was the only path that handled `power_lost` — the event is now silently ignored in some states
- **False simplification**: The plan claims "simplified error handling" but merges two states with different recovery paths into one, losing the distinction

## Manual Verification Mode

When Python is NOT available (air-gapped embedded dev machine, locked-down Windows), execute each check manually. The agent performs the verification using its own reasoning — the methodology is identical, only the execution engine changes.

### Size Limit

Manual verification is reliable for state machines with **≤ 10 states and ≤ 30 transitions**. For larger machines, manual BFS and cycle detection become error-prone. If the machine exceeds this threshold and Python is unavailable, either:

- Decompose the machine into sub-machines and verify each independently, then check cross-machine contracts manually
- Flag the size limitation as a finding and recommend the user run the Python harness offline

### Prerequisites

- Transition table has been extracted and confirmed with the user
- You have the full table in context (from Phase 2 extraction step)
- **Harness validation** (Python mode only): After filling in `verification-harness.py`, translate the Python `STATES` dict BACK into a transition table and compare it against the confirmed extraction table. If they differ, fix the harness. This catches typo and whitespace errors in manual dict construction.

### Phase 2a — Manual Structural Checks

**S1 Reachability**: Start from INIT. For each state, ask: "Is there any sequence of events from INIT that reaches this state?" Mark each state as reachable or unreachable. Unreachable states are dead code — flag them.

**S2 Deadlock**: For each non-terminal state, count outgoing transitions. If count = 0, flag as DEADLOCK. Terminal states are exempt.

**S3 Liveness**: Look for cycles in the transition graph that have no exit to a terminal/recovery state. Example: ERROR → RECOVERING → ERROR forms a cycle. If RECOVERING has a transition to IDLE, it's fine. If every transition from the cycle stays in the cycle with no terminal exit, flag as LIVELOCK.

**S4 Determinism**: For each state, group transitions by base event name (strip guard suffixes). If two transitions share the same base event and have different targets without different guard conditions, flag as AMBIGUOUS.

**S5 Event Completeness**: Collect all unique event names. For each non-terminal state, list which events have no defined transition. Flag any state missing handlers for events that other states define — these will be silently ignored at runtime.

**S6 Guard Completeness**: For each transition with a guard (e.g., `timeout (retry<3)` → RETRY), check if the complementary branch is defined (e.g., `timeout (retry≥3)` → FATAL). If only one branch exists with no else/default, flag as INCOMPLETE GUARD.

**S7 Invariants**: For each "always/never/guaranteed" claim in the plan, trace every reachable path and verify the claim holds. If you find a counter-example path, quote the plan claim, show the violating path, flag as INVARIANT VIOLATION.

### Phase 2b — Manual Adversarial Probes

**A1 Unexpected Event**: For each state, list all events defined ANYWHERE in the machine that this state does NOT handle. For each unhandled (state, event) pair, assess: is this event physically possible in this state? If yes, what happens? Silence = undefined behavior. Flag if the plan doesn't document the behavior.

**A2 Race Interleaving**: Identify pairs of events that could arrive in the same tick (e.g., timer expiry + message arrival). Trace both orders through the machine. If the final state differs, flag as RACE — the outcome depends on event ordering.

**A3 Order Permutation**: Take 3-5 key events and trace all permutations. If different orders lead to different terminal states AND the plan claims independence, flag as ORDER DEPENDENT.

**A4 Pair Symmetry**: Identify all `lock/unlock`, `start/stop`, `alloc/free` pairs. Check every path: if a path includes `lock` without a subsequent `unlock`, or `alloc` without `free`, flag as ASYMMETRIC. A quick heuristic: if a transition name contains "lock" (or "start", "alloc"), check that every path from its target state eventually hits the corresponding "unlock" before a terminal state.

**A5 Boundary Blast**: For each counter variable mentioned in guards, test values: 0, 1, max-1, max, max+1. Flag any that would cause overflow or undefined behavior. For timestamps, check if `elapsed = now - start` handles wraparound correctly.

**A6 Resource Injection**: For each state that appears to allocate (names containing "alloc", "init", "start", "open", "connect", "begin"), check if there is a recovery/error path if the allocation fails. If no recovery exists, flag as RESOURCE VULNERABLE.

**A7 Minimal Counter-Example**: For each invariant that failed in S7, find the SHORTEST event sequence that violates it. This is the most useful output — it gives the plan author an exact repro.

### Manual Mode Output Format

For each finding, output the same structured format as the Python harness:

```text
[CHECK] S1 Reachability
  RESULT: PASS — All 7 states reachable from INIT

[CHECK] S3 Liveness
  RESULT: FAIL — Absorbing cycle: ERROR → RECOVERING → ERROR
  EVIDENCE: RECOVERING has only one transition (→ ERROR after cooldown).
            No path from RECOVERING back to IDLE exists.
  SEVERITY: Error — machine can never recover from ERROR state.
```

Manual verification takes longer but produces identical-quality findings. The key advantage: it requires zero dependencies and works on any platform.

## Integration with the Review Pipeline

```text
1. Load fact-verification skill
2. Read plan → Phase 1 (enumerate claims)
3. Detect behavioral claims → trigger logic-primitive escalation
4. Load this guide
5. Check Python: `python3 --version` or `python --version`
6a. Python ≥ 3.6 → load verification-harness.py → fill in MODEL → run
6b. No Python → use Manual Verification Mode (see above) — execute each check step by step
7. Extract model → show transition table → GET USER CONFIRMATION
8. Run Phase 2a (7 structural primitives) → log results
9. Run Phase 2b (7 adversarial probes) → log results
10. Classify counter-examples (true positive / model error / acceptable risk)
11. Feed confirmed findings into Phase 3 (gap analysis)
12. Include in Phase 5 (structured output)
```

Never skip step 5. A verified model based on wrong extraction is worse than no verification — it creates false confidence.
