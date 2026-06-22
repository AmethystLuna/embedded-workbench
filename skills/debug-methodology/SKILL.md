---
name: debug-methodology
description: "Use when debugging embedded firmware issues, analyzing crash logs, triaging HardFault, investigating state machine lockups, or tracing sensor/signal anomalies."
---

# Debug Methodology

Debug by tracing values, not symptoms. These patterns come from real debugging sessions where surface-level fixes failed and root-cause analysis succeeded.

**REQUIRED BACKGROUND:** If the issue involves state machines or protocol timeouts, load `Skill("state-machine-design")` first. If the issue involves FreeRTOS tasks, ISRs, or NVM storage, load `Skill("embedded-firmware-dev")` first. Understand the domain rules before applying debugging methodology.

## Red Flags

| You think | Reality |
|-----------|---------|
| "I know where the bug is, let me fix it" | You know the symptom location. The root cause is often 3 layers away in a different module. |
| "One more round of trial fixes and I'll get it" | After 2 failed attempts, you need methodology, not persistence. |
| "I'll just add a bounds check and call it done" | You're masking a symptom. The real fix is at the data source, not at every consumer. |
| "The logs look normal, it must be a hardware glitch" | If you haven't correlated timestamps to code branches, you haven't actually read the logs. |

## Iron Rules

1. **Log first, not code first**: Correlate serial log timestamps to code branches before touching code. One log line at a known timestamp is worth more than reading five source files.

2. **Call-point census**: When a value isn't updating, find all call sites of the update function. A single call site (e.g., `sensor_update()` only at `main_loop.c:47`) immediately explains why refresh is delayed or gated by irrelevant conditions.

3. **Cache freshness ≠ source data readiness**: In embedded systems, "sensor has data" and "derived cache is refreshed" are concurrent events. Prefer **pull mode** (sync cache on read when source is ready). Avoid pure push mode (periodic background updaters may not fire before the first consumer reads).

4. **Multi-path convergence**: When multiple independent code paths show the same error, find the shared state or cache they all read. Fix once at the update point — smaller fix, and future callers can't bypass it.

5. **Ownership boundary mapping**: Before changing behavior, identify which module owns the truth, which derives policy, and which only consumes. Don't let the GUI control backlight policy. Don't let the backlight module control DND state.

6. **Progressive narrowing**: Each investigation round shrinks scope — phenomenon → mechanism → specific state → root cause. Don't try to solve everything at once.

7. **Minimal root-cause fix**: The fix is usually 1-2 lines at the data source. If you're changing 5+ call sites, stop and ask: what single state change would make all of them correct without modification?

8. **Library source is truth**: After 2-3 rounds of custom implementation failure, stop iterating. Read the library source code (e.g., LVGL's `lv_line.c`, `lv_chart.c`) to understand the native mechanism. Adopt and adapt. Verified patterns beat custom math.

## Fix Principles

- Draw the failure signature, event timeline, and state transition chain before changing code.
- For defects near state transitions: trace the **exact state consumed** by that output. Stale behavior often hides in derived state, not the primary truth.
- **Fix state models, don't mask symptoms**: don't paper over problems with bigger limits, buffers, or retries.
- Prefer correcting underlying logic over adding special-case branches. Only special-handle when no cleaner alternative exists.
- If a bug is triggered by entering/leaving/recovering from a state, **verify every entry path** that reaches the relevant helper, not just the reproduced path.
- After each fix, verify the normal path, failure path, and recovery path.

## Exploration

For broad codebase searches (finding all callers of a function, locating cross-module patterns), use `Agent(subagent_type: "Explore")` instead of chaining Grep/Glob calls.

## Deep Reference

This skill's `references/` directory contains:

| Reference | Topic | Load When |
|-----------|-------|-----------|
| `iterative-debug-case-study.md` | 7-round progressive isolation methodology | Stuck after multiple fix attempts; need a structured debugging approach |
