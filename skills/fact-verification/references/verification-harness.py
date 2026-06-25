#!/usr/bin/env python3
"""State Machine Verification Harness — generic template for fact-verification Phase 2a/2b.

Fill in the MODEL section below with states, transitions, invariants extracted from the plan.
Run: python3 verification-harness.py
Output: structured verification report for Phase 3 gap analysis.
"""
import sys
from collections import deque
from itertools import permutations

# =============================================================================
# MODEL — fill in from plan extraction
# =============================================================================

STATES: dict[str, dict[str, str]] = {
    # "STATE_NAME": {
    #     "event_or_condition": "NEXT_STATE",
    #     "another_event": "ANOTHER_STATE",
    # },
    # For guarded transitions, encode guard in event name:
    #     "timeout (retry_count==0)": "RETRY",
    #     "timeout (retry_count>=1)": "FATAL",
}

INIT: str = "INIT"

TERMINALS: set[str] = set()  # States where machine intentionally stops

# Invariants: list of {"desc": "human description", "check": lambda states, reachable: bool}
INVARIANTS: list[dict] = []

# Event pairs that can arrive concurrently (for A2 race interleaving)
CONCURRENT_PAIRS: list[tuple[str, str]] = []

# Counter/timer variables mentioned in guards (for A5 boundary blast)
# Format: {"name": "variable_name", "max_valid": max_value, "type": "counter|timestamp"}
BOUNDARY_VARS: list[dict] = []

# Paired operations (for A4 pair symmetry)
# Format: ("acquire_event_name", "release_event_name")
PAIRS: list[tuple[str, str]] = [
    # ("lock", "unlock"),
    # ("alloc", "free"),
    # ("start", "stop"),
]

# =============================================================================
# PHASE 2a: STRUCTURAL PRIMITIVES
# =============================================================================

def all_states():
    return set(STATES.keys())

def all_events():
    events = set()
    for trans in STATES.values():
        events.update(trans.keys())
    return events

def S1_reachability():
    """BFS from INIT — find unreachable states."""
    visited = set()
    queue = deque([INIT])
    while queue:
        s = queue.popleft()
        if s in visited:
            continue
        visited.add(s)
        for nxt in STATES.get(s, {}).values():
            if nxt not in visited:
                queue.append(nxt)
    unreachable = all_states() - visited
    return {
        "pass": len(unreachable) == 0,
        "reachable": sorted(visited),
        "unreachable": sorted(unreachable),
        "detail": f"{len(unreachable)} unreachable: {sorted(unreachable)}" if unreachable else "All states reachable",
    }

def S2_deadlock():
    """Any non-terminal state with zero outgoing transitions?"""
    deadlocks = []
    for s in sorted(all_states()):
        if s not in TERMINALS and len(STATES.get(s, {})) == 0:
            deadlocks.append(s)
    return {
        "pass": len(deadlocks) == 0,
        "deadlocks": deadlocks,
        "detail": f"Deadlocks: {deadlocks}" if deadlocks else "No deadlocks",
    }

def S3_liveness():
    """Detect absorbing cycles that exclude expected terminal/recovery states."""
    # Build reverse graph to find cycles
    cycles = []
    for start in all_states():
        # DFS from each state to find cycles
        def find_cycle(s, path, visited_cycle):
            if s in visited_cycle:
                idx = path.index(s)
                return path[idx:]
            visited_cycle.add(s)
            for nxt in STATES.get(s, {}).values():
                result = find_cycle(nxt, path + [s], visited_cycle.copy())
                if result:
                    return result
            return None

        cycle = find_cycle(start, [], set())
        if cycle and cycle not in cycles:
            cycles.append(cycle)

    # An absorbing cycle is one where ALL transitions from cycle states stay in the cycle
    absorbing = []
    for cycle in cycles:
        cycle_set = set(cycle)
        is_absorbing = True
        for s in cycle:
            for nxt in STATES.get(s, {}).values():
                if nxt not in cycle_set:
                    is_absorbing = False
                    break
            if not is_absorbing:
                break
        if is_absorbing:
            # Check if cycle excludes terminal/recovery states
            if not (cycle_set & TERMINALS):
                absorbing.append(cycle)

    return {
        "pass": len(absorbing) == 0,
        "absorbing_cycles": absorbing,
        "all_cycles": cycles,
        "detail": f"Absorbing cycles (no exit, no terminal): {absorbing}" if absorbing else "No harmful absorbing cycles",
    }

def S4_determinism():
    """Same (state, event) → multiple different targets?"""
    # The dict-of-dicts structure is inherently deterministic per event key.
    # This check verifies: for each state, event names are unambiguous (no duplicates).
    ambiguous = []
    for s in sorted(all_states()):
        seen = {}
        for event, target in STATES.get(s, {}).items():
            base = event.split("(")[0].strip()  # Strip guard suffix for comparison
            if base in seen and seen[base] != target:
                ambiguous.append((s, base, seen[base], target))
            seen[base] = target
    return {
        "pass": len(ambiguous) == 0,
        "ambiguous": ambiguous,
        "detail": f"Ambiguous transitions: {ambiguous}" if ambiguous else "Deterministic",
    }

def S5_event_completeness():
    """States missing handlers for events that other states handle."""
    events = all_events()
    warnings = []
    for s in sorted(all_states()):
        if s in TERMINALS:
            continue
        handled = set(STATES.get(s, {}).keys())
        # Only flag if a state is missing events that are relevant (handled elsewhere)
        relevant = set()
        for e in events - handled:
            # Check if this event type appears in guard variants
            base = e.split("(")[0].strip()
            if any(base in h for h in handled):
                pass  # Already handled via guard variant
            else:
                relevant.add(e)
        if relevant:
            warnings.append((s, sorted(relevant)))
    return {
        "pass": len(warnings) == 0,
        "warnings": warnings,
        "detail": f"Missing event handlers: {warnings}" if warnings else "All states handle all relevant events",
    }

def S6_guard_completeness():
    """For each transition with a guard condition, are ALL branch outcomes defined?"""
    # Group transitions by (state, base_event)
    guard_groups = {}
    for s in sorted(all_states()):
        for event in STATES.get(s, {}):
            base = event.split("(")[0].strip()
            key = (s, base)
            if key not in guard_groups:
                guard_groups[key] = []
            guard_groups[key].append(event)

    incomplete = []
    for (s, base), variants in guard_groups.items():
        if len(variants) > 1:
            # Guard exists — check if there's a default/else path
            has_default = any("else" in v.lower() or "default" in v.lower() for v in variants)
            has_explicit = len(variants) >= 2  # At minimum, two guard branches
            # Heuristic: if we have guard variants but no explicit "else", flag it
            if not has_default:
                incomplete.append({
                    "state": s,
                    "event": base,
                    "variants": variants,
                    "missing": "else/default branch",
                })
    return {
        "pass": len(incomplete) == 0,
        "incomplete_guards": incomplete,
        "detail": f"Incomplete guards: {incomplete}" if incomplete else "All guard branches defined or single-path",
    }

def S7_invariants():
    """Verify each claimed invariant against all reachable states."""
    # First compute reachable set
    visited = set()
    queue = deque([INIT])
    while queue:
        s = queue.popleft()
        if s in visited:
            continue
        visited.add(s)
        for nxt in STATES.get(s, {}).values():
            if nxt not in visited:
                queue.append(nxt)

    violations = []
    for inv in INVARIANTS:
        try:
            if not inv["check"](STATES, visited):
                violations.append(inv["desc"])
        except Exception as e:
            violations.append(f"{inv['desc']} — ERROR: {e}")

    return {
        "pass": len(violations) == 0,
        "violations": violations,
        "detail": f"Invariant violations: {violations}" if violations else "All invariants hold",
    }

# =============================================================================
# PHASE 2b: ADVERSARIAL PROBES
# =============================================================================

def step(current, events):
    """Simulate a sequence of events from current state. Returns final state."""
    s = current
    for e in events:
        if s in TERMINALS:
            break
        trans = STATES.get(s, {})
        # Exact match first
        if e in trans:
            s = trans[e]
        else:
            # Try matching guard variants — pick the first matching base event
            base_match = None
            for evt, target in trans.items():
                if evt.startswith(e) or e.startswith(evt.split("(")[0].strip()):
                    base_match = target
                    break
            if base_match:
                s = base_match
            # else: event ignored (unhandled) — stay in current state
    return s

def A1_unexpected_event():
    """Inject every event into every state that doesn't handle it."""
    events = all_events()
    findings = []
    for s in sorted(all_states()):
        if s in TERMINALS:
            continue
        handled = set(STATES.get(s, {}).keys())
        unhandled = events - handled
        if unhandled:
            findings.append({
                "state": s,
                "unhandled": sorted(unhandled),
                "risk": "Event silently ignored — may represent undefined behavior",
            })
    return {
        "pass": len(findings) == 0,
        "findings": findings,
        "detail": f"{len(findings)} states with unhandled events" if findings else "All event/state combinations defined",
    }

def A2_race_interleaving():
    """For each concurrent pair, test both arrival orders."""
    if not CONCURRENT_PAIRS:
        return {"pass": True, "findings": [], "detail": "No concurrent pairs defined — skipped"}

    findings = []
    for e1, e2 in CONCURRENT_PAIRS:
        # Test from each state where both events are possible
        for s in sorted(all_states()):
            trans = STATES.get(s, {})
            if e1 not in trans and e2 not in trans:
                continue
            final_e1e2 = step(s, [e1, e2])
            final_e2e1 = step(s, [e2, e1])
            if final_e1e2 != final_e2e1:
                findings.append({
                    "state": s,
                    "pair": (e1, e2),
                    "final_e1_then_e2": final_e1e2,
                    "final_e2_then_e1": final_e2e1,
                    "risk": "Order-dependent outcome",
                })
    return {
        "pass": len(findings) == 0,
        "findings": findings,
        "detail": f"{len(findings)} order-dependent race conditions" if findings else "No race conditions detected",
    }

def A3_order_permutation():
    """Test if different event orderings produce different terminal states."""
    events = sorted(all_events())
    if len(events) > 5:
        # Too many permutations — sample subset
        events = events[:5]

    # Find event sequences that reach different terminals
    terminal_sets = []
    for perm in permutations(events):
        final = step(INIT, list(perm))
        terminal_sets.append((list(perm), final))

    unique_terminals = set(t[1] for t in terminal_sets)

    findings = []
    if len(unique_terminals) > 1:
        # Find the sequences producing each terminal
        by_terminal = {}
        for seq, term in terminal_sets:
            by_terminal.setdefault(term, []).append(seq)
        findings.append({
            "terminal_states": sorted(unique_terminals),
            "sequences": {t: seqs[0] for t, seqs in by_terminal.items()},
            "risk": f"Same events produce {len(unique_terminals)} different outcomes",
        })

    return {
        "pass": len(findings) == 0,
        "findings": findings,
        "detail": f"Order-dependent: {len(unique_terminals)} different outcomes" if findings else "Order-independent",
    }

def A4_pair_symmetry():
    """Check lock/unlock, alloc/free, start/stop symmetry."""
    if not PAIRS:
        return {"pass": True, "findings": [], "detail": "No paired operations defined — skipped"}

    events = all_events()
    findings = []

    for acquire, release in PAIRS:
        # Check if this pair type is even used in the model
        acquire_events = [e for e in events if acquire in e.lower()]
        release_events = [e for e in events if release in e.lower()]

        if not acquire_events and not release_events:
            continue

        # Simple check: for each acquire event, is there a corresponding release?
        # More sophisticated: every path that contains acquire must contain release
        # before reaching a terminal state or another acquire.

        # Quick heuristic: count occurrences in transition targets
        acquire_targets = set()
        release_sources = set()
        for s, trans in STATES.items():
            for e, t in trans.items():
                if any(ae in e.lower() for ae in acquire_events):
                    acquire_targets.add(t)
                if any(re in e.lower() for re in release_events):
                    release_sources.add(s)

        if acquire_targets and not release_sources:
            findings.append({
                "pair": (acquire, release),
                "risk": f"'{acquire}' used but no '{release}' found — resource leak likely",
            })

    return {
        "pass": len(findings) == 0,
        "findings": findings,
        "detail": f"Asymmetric pairs: {findings}" if findings else "All pairs balanced",
    }

def A5_boundary_blast():
    """Probe counter/timer boundary values."""
    if not BOUNDARY_VARS:
        return {"pass": True, "findings": [], "detail": "No boundary variables defined — skipped"}

    findings = []
    for var in BOUNDARY_VARS:
        name = var["name"]
        max_val = var.get("max_valid", 255)
        vtype = var.get("type", "counter")

        test_values = [0, 1, max_val - 1, max_val, max_val + 1]
        if vtype == "counter":
            test_values += [2**8 - 1, 2**16 - 1, 2**32 - 1]

        for tv in test_values:
            if tv < 0 or tv > max_val:
                findings.append({
                    "variable": name,
                    "tested_value": tv,
                    "max_valid": max_val,
                    "risk": f"Value {tv} exceeds max valid {max_val} — overflow possible",
                })

        if vtype == "timestamp":
            findings.append({
                "variable": name,
                "risk": "Timestamp wraparound — verify elapsed_ms() / elapsed_ticks() handle wraparound correctly",
            })

    return {
        "pass": len(findings) == 0,
        "findings": findings,
        "detail": f"Boundary issues: {len(findings)}" if findings else "Boundary checks passed",
    }

def A6_resource_injection():
    """Simulate resource failures at each state."""
    # Heuristic: identify states that likely allocate resources
    findings = []
    for s in sorted(all_states()):
        if s in TERMINALS:
            continue
        state_lower = s.lower()
        events_lower = [e.lower() for e in STATES.get(s, {}).keys()]

        # Does this state look like it allocates resources?
        alloc_keywords = ["alloc", "create", "init", "start", "open", "connect", "begin"]
        has_alloc = any(kw in state_lower or any(kw in e for e in events_lower) for kw in alloc_keywords)

        if not has_alloc:
            continue

        # Does it have an error recovery path?
        error_keywords = ["error", "fail", "retry", "timeout", "recover", "fatal"]
        has_recovery = any(any(kw in e for e in events_lower) for kw in error_keywords)

        if not has_recovery:
            findings.append({
                "state": s,
                "risk": f"State '{s}' may allocate resources but has no visible error recovery path",
            })

    return {
        "pass": len(findings) == 0,
        "findings": findings,
        "detail": f"Resource vulnerability: {len(findings)} states" if findings else "No resource vulnerabilities detected",
    }

def A7_shortest_violation(invariant_results):
    """Find shortest violating path for each failed invariant (requires re-running with path tracking)."""
    if not INVARIANTS:
        return {"pass": True, "findings": [], "detail": "No invariants defined — skipped"}

    findings = []
    for inv in INVARIANTS:
        # BFS to find shortest path to violation
        queue = deque([(INIT, [])])
        visited = set()
        found = None

        while queue and not found:
            s, path = queue.popleft()
            if s in visited:
                continue
            visited.add(s)

            try:
                if not inv["check"](STATES, {s}):
                    found = path
                    break
            except Exception:
                found = path
                break

            for event, nxt in STATES.get(s, {}).items():
                if nxt not in visited:
                    queue.append((nxt, path + [(s, event, nxt)]))

        if found:
            findings.append({
                "invariant": inv["desc"],
                "violating_path": found,
                "path_length": len(found),
            })

    return {
        "pass": len(findings) == 0,
        "findings": findings,
        "detail": f"Violated invariants: {len(findings)}" if findings else "All invariants hold for all reachable paths",
    }

# =============================================================================
# MAIN
# =============================================================================

def run_all():
    results = {}
    errors = 0
    warnings = 0

    print("=" * 60)
    print("PHASE 2a: STRUCTURAL PRIMITIVES")
    print("=" * 60)

    checks_2a = [
        ("S1 Reachability", S1_reachability),
        ("S2 Deadlock", S2_deadlock),
        ("S3 Liveness", S3_liveness),
        ("S4 Determinism", S4_determinism),
        ("S5 Event Completeness", S5_event_completeness),
        ("S6 Guard Completeness", S6_guard_completeness),
        ("S7 Invariants", S7_invariants),
    ]

    for name, check_fn in checks_2a:
        result = check_fn()
        results[name] = result
        status = "PASS" if result["pass"] else "FAIL"
        prefix = "  " if result["pass"] else "  [!] "
        print(f"{prefix}[{status}] {name}: {result['detail']}")
        if not result["pass"]:
            if "Warning" in str(type(check_fn)):
                warnings += 1
            else:
                errors += 1

    print()
    print("=" * 60)
    print("PHASE 2b: ADVERSARIAL PROBES")
    print("=" * 60)

    probes_2b = [
        ("A1 Unexpected Event", A1_unexpected_event),
        ("A2 Race Interleaving", A2_race_interleaving),
        ("A3 Order Permutation", A3_order_permutation),
        ("A4 Pair Symmetry", A4_pair_symmetry),
        ("A5 Boundary Blast", A5_boundary_blast),
        ("A6 Resource Injection", A6_resource_injection),
        ("A7 Shortest Violation", lambda: A7_shortest_violation(results.get("S7 Invariants", {}))),
    ]

    for name, probe_fn in probes_2b:
        result = probe_fn()
        results[name] = result
        status = "PASS" if result["pass"] else "FAIL"
        prefix = "  " if result["pass"] else "  [!] "
        print(f"{prefix}[{status}] {name}: {result['detail']}")
        if not result["pass"]:
            warnings += 1  # Probe failures are warnings by default (may be false positives)

    print()
    print("=" * 60)
    print(f"SUMMARY: {errors} structural errors, {warnings} probe/other warnings")
    print("=" * 60)

    if errors > 0:
        print()
        print("ACTION: Fix structural errors before proceeding to Phase 3.")
        print("Structural errors indicate the plan's logic is incomplete or inconsistent.")

    if warnings > 0 and errors == 0:
        print()
        print("ACTION: Review probe warnings — may be false positives or acceptable risks.")
        print("Escalate confirmed findings to Phase 3 gap analysis.")

    return errors, warnings, results


if __name__ == "__main__":
    errors, warnings, results = run_all()
    sys.exit(1 if errors > 0 else 0)
