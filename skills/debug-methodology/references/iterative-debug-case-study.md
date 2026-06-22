# Iterative Debugging: A Case Study in Progressive Isolation

This document models a real embedded debugging journey — not the specific bug, but the **methodology** that uncovered it across 7 rounds of progressive refinement. Use this as a reference for structuring your own debugging sessions.

## The Pattern: 7 Rounds of Progressive Narrowing

### Round 1 — Symptom: "Loading spinner never resolves"

**Initial observation**: After power-on, a sensor display page shows a loading state indefinitely. The sensor appears to be working — data is arriving at the driver level.

**First hypothesis**: The warmup timer is too short.

**Action**: Double the warmup period.

**Result**: No change. The problem is not timing.

**Lesson**: Don't tune constants without understanding the state machine. "Not waiting long enough" is the most common wrong first hypothesis.

### Round 2 — Mechanism: Timer vs. Driver ownership

**Observation**: The warmup timer lives in the sensor aggregation layer. The sensor driver has its own initialization state flowing independently.

**Hypothesis**: The timer and driver initialization are racing — the timer expires before the driver completes init.

**Action**: Move the warmup gate from the aggregation layer into the driver, where it can directly observe initialization completion.

**Result**: Improves reliability but doesn't fully fix. Some edge cases remain.

**Lesson**: Cache freshness ≠ source data readiness. The timer firing means "enough time passed," not "the sensor is ready." Couple the gate to the actual readiness signal.

### Round 3 — Edge case: Black screen after sensor disconnect/reconnect

**Symptom**: Unplugging and re-plugging the sensor during operation causes a permanent black screen instead of recovery.

**Investigation**: A global animation timer's callback is firing on a freed LVGL object, corrupting the event dispatch chain (HardFault: INVSTATE, LR in event_send_core, PC in SRAM).

**Root cause**: The animation timer outlives the page it belongs to. On page exit, the timer is deleted, but a race window allows one final callback to fire on freed memory.

**Fix**: Add a generation counter to the animation timer module. Each Create/Delete cycle increments the counter. The callback checks the generation against its captured value and safely returns if mismatched.

**Lesson**: Timer lifecycle bugs produce crashes with a distinctive signature: LR in event dispatch, PC in data memory. When you see this, audit all timer Create/Delete pairs before touching any other code.

### Round 4 — Architecture: Gating order matters

**Symptom**: The sensor recovers after disconnect, but the display shows "Loading" instead of the measurement.

**Investigation**: The recovery path's gating order is wrong. Warmup completion is checked **before** the communication error flag is cleared, so the warmup condition is satisfied (timer expired) while the error condition still blocks display.

**Fix**: Reorder the gates: check for errors first, then warmup, then data validity. Each gate must explicitly pass before proceeding to the next.

**Lesson**: Multiple independent conditions at a transition gate — verify each one explicitly. Don't assume "timer expired = everything healthy."

### Round 5 — Systemic flaw: One-directional state latch

**Symptom**: Once the display reaches "Ready" state, it never returns to "Loading" even when the sensor is disconnected and reconnected. The value briefly shows stale data, then disappears.

**Investigation**: The state machine transitions `WarmingUp → Ready` when warmup completes, but has no reverse path. When the sensor later encounters an error, the state stays Ready because no code path resets it.

**Root cause**: The state transition model assumes forward-only progress. Real systems need bidirectional transitions.

**Fix**: Add a reverse guard at the top of the state update function: if `state == Ready && error_active()`, reset to `WarmingUp`. This runs before any forward transitions.

**Lesson**: **One-directional latches are a systemic anti-pattern.** If a target state's preconditions can become false while in that state, you need a reverse transition. Audit every state variable: can it ever need to go backward?

### Round 6 — Ghost data: Derived state not cleared on reset

**Symptom**: After the Round 5 fix, a brief flicker shows a stale measurement value before Loading appears.

**Investigation**: The state reset (Ready → WarmingUp) clears `display_state` but does NOT clear `cached_sensor_value`. The old valid cached value passes a downstream `if (value > 0) → show Ready` check in the narrow window before the warmup timer starts.

**Fix**: In the reset function, clear `cached_sensor_value = NAN` alongside the state reset. Both must be cleared atomically by a single entry point.

**Lesson**: **Derived state invariant**: When resetting a primary state, also reset all derived/cached values computed from it. A single stale derived value can bypass every guard in the system.

### Round 7 — Consolidation: Single computation point

**Symptom**: Multiple display pages have slightly different loading/error display logic, causing inconsistent behavior across the UI.

**Investigation**: The display strategy logic (show value vs. show loading vs. show error) is duplicated across pages, with subtle variations.

**Fix**: Extract a single `compute_display_strategy(actual_state, error_info)` function. All pages call it. The function owns the decision; pages only render the result.

**Lesson**: When the same decision logic appears in 3+ places, consolidate it. Pages should consume display decisions, not compute them.

## Methodology Summary

| Round | What Changed | Method |
|-------|-------------|--------|
| 1 | Nothing | Tuning constants without understanding — **don't do this** |
| 2 | Reliability improved | Moved gate to data source — coupling check to actual signal |
| 3 | Crash fixed | Generation counter pattern — timer lifecycle safety |
| 4 | Recovery fixed | Gate ordering — explicit precondition verification |
| 5 | State fixed | Bidirectional transition — reverse guard pattern |
| 6 | Flicker fixed | Derived state invariant — atomic reset |
| 7 | Architecture fixed | Single computation point — consolidation |

## Key Takeaways

1. **Start with the state machine, not the symptoms.** Round 1 wasted time on a constant that Round 5 proved irrelevant.
2. **Each fix reveals the next layer.** Don't try to fix everything at once. Round 2 exposed Round 3; Round 5 exposed Round 6.
3. **Derived state is the most common source of subtle bugs.** Cached values, computed flags, display strategies — anything not at the source of truth.
4. **One-directional state latches are always wrong eventually.** If you can't answer "what makes it go back?", you have a bug waiting to happen.
5. **Consolidation happens last, not first.** Fix the individual bugs before extracting common patterns.
