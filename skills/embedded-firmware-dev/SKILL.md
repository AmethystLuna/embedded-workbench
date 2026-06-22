---
name: embedded-firmware-dev
description: "Use when writing or reviewing embedded C firmware, FreeRTOS tasks, ISR handlers, NVM/flash storage, or sensor driver state machines."
---

# Embedded Firmware Development

## FreeRTOS

- Give each task a clear ownership boundary. Shared resources need a deliberate synchronization strategy.
- Prefer task notifications for one-to-one wakeups, queues for data transfer, event groups for combined state, mutexes for mutual exclusion, semaphores for one-way signaling.
- Use a mutex (not binary semaphore) when mutual exclusion matters and priority inheritance is needed.
- Make every blocking wait explicit: use a timeout unless an infinite wait is deliberate.
- Keep timer callbacks short and non-blocking — use them to schedule work, not do it.
- Avoid holding locks across flash, storage, or long operations.
- Size task stacks from worst-case call chains. Recheck high-water marks after adding buffers or deeper call trees.
- Use ISR-safe APIs for interrupt-to-task handoff. Keep ISR state capture minimal.
- Avoid priority inversion: don't hold shared locks across blocking I/O or long processing.
- If a task can be paused/restarted/signaled from multiple places, define resume, timeout, and recovery paths explicitly.
- For cross-task pointer ownership: make lifetime and invalidation rules obvious.
- Prefer the smallest critical section that protects the state transition. Don't wrap whole operations in locks when narrower ordering suffices.
- For objects handed between threads: define whether the receiver owns, borrows, or copies before crossing the boundary.

## Interrupts / ISR

- Keep the interrupt path short, deterministic, and bounded. Capture minimum state, clear the source, defer expensive work.
- Do not block, sleep, allocate heap, or call non-ISR-safe APIs from an ISR.
- Prefer top-half/bottom-half split when the handler needs more than quick state capture and wakeup.
- Make shared-state ownership explicit. Use minimum synchronization for the data being shared.
- If an ISR wakes a task, use the ISR-safe RTOS primitive and preserve yield-from-ISR behavior.
- Define clear read/clear/re-enable ordering to avoid losing edges or creating re-trigger loops.
- Avoid logging and complex branching in the hot interrupt path.
- If code runs from both task and ISR context, separate wrappers so the ISR-safe path stays obvious.

## Async Lifecycle Cleanup

- Any async flag (pending, in-progress, busy, data-ready) that can be set during normal operation must be explicitly cleared in every stop, init, reset, power-off, and error-recovery path. A stale flag silently blocks the next operation.
- When adding a new async operation, audit all lifecycle entry points and ensure each path resets flags to known-safe.
- Cleanup must happen before any new operation is attempted, not after.

## One-Shot Event Consumption

- When a low-level driver produces a transient event that multiple higher-level consumers need, use an atomic check-and-clear (consume) API rather than shared flags each consumer clears manually.
- Manual clearing by multiple consumers creates races: consumer A clears before B reads, or B reads a flag already set again by the next cycle.
- The consume primitive returns whether the event occurred and atomically clears the latch — every interested consumer observes the event exactly once per occurrence.

## Storage / Persistence

- Separate object corruption from schema change. Rebuild the whole store only when versioned layout rules require it.
- Prefer recoverable write paths: write primary → read back and verify → write backup → read back and verify.
- During delete, reset, or migration, preserve at least one valid recoverable copy.
- Prefer targeted repair and re-sync over destructive reinitialization.
- Treat startup repair, steady-state writes, emergency writes, and factory reset as separate paths with explicit guarantees.

## Boundary Analysis

- When thresholds trip at edges, inspect debounce latency, sample timing, and ring-vs-bounded assumptions before tuning constants.
- When behavior diverges by mode, compare all branches side by side instead of debugging only the failing branch.
- When a defect appears on only one trigger path, diff which state each caller resets, preserves, or derives.
- For transient inconsistencies, inspect raw state, derived state, and cached state separately — stale data in any layer masquerades as a timing problem.
- When a system undergoes mode switch, direction reversal, or re-initialization, allow a bounded tolerance window for the first post-transition deviation. Treating it with steady-state thresholds produces false error accumulation.

## Deep Reference

This skill's `references/` directory contains in-depth material. Load when you need more than the core rules:

| Reference | Topic | Load When |
|-----------|-------|-----------|
| `architecture-principles.md` | 12 architecture design principles | Designing module boundaries, state ownership, or GUI architecture |
| `embedded-patterns.md` | GIF timer safety, async lifecycle, state latches | Debugging timer crashes, stale flags, or state corruption |
| `lvgl-pitfalls.md` | LVGL layout, alignment, alpha, and mask traps | Debugging LVGL rendering artifacts or HardFault in draw paths |

See also: `Skill("state-machine-design")` for state transition rules, `Skill("debug-methodology")` for debugging process.
