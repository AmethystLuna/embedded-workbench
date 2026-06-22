# Embedded Engineering Patterns

Recurring patterns from real firmware debugging sessions. Generic and reusable across projects.

## GIF / Animation Timer Lifecycle Safety

Animated UI elements (GIFs, sprite sheets, frame animations) use hardware timers with callbacks. Improper lifecycle management causes HardFault (INVSTATE, corrupted callback pointers).

### Pattern: Generation Counter Guard

**Problem**: A timer callback fires after the animated object has been deleted. The callback's user_data pointer references freed memory.

**Fix**: Maintain a module-level `generation` counter. Increment on each `Create`/`Delete` cycle. The timer callback captures the generation at creation time and compares it to the current value before accessing any object.

```
timer_cb:
  if (captured_generation != global_generation) {
    // Object was deleted and recreated; safely delete this stale timer
    lv_timer_del(timer);
    return;
  }
  // Safe to use objects
```

### Pattern: Cleanup Ordering

**Problem**: Calling `lv_obj_clean()` before deleting the animation timer allows the timer to fire on already-cleaned children.

**Fix**: Always delete the animation timer **first**, then clean the parent object. In page exit functions:

```
void page_exit() {
    anim_timer_del();    // 1. Kill the timer
    lv_obj_clean(page);  // 2. Then clean objects
}
```

### Pattern: Null-After-Free for Static Pointers

**Problem**: A static LVGL object pointer (e.g., `static lv_obj_t *icon`) retains its value after `lv_obj_clean()` frees the underlying object. On re-entry, `lv_img_set_src(icon, ...)` dereferences freed memory.

**Fix**: Set static LVGL pointers to NULL immediately after `lv_obj_clean()` or `lv_obj_del()`. In `Setup()`, guard against NULL before using any cached pointer.

## One-Directional State Latch Anti-Pattern

### Problem

A state variable transitions `A → B` when condition X becomes true, but never transitions back to `A` even when X becomes false again. The one-way latch silently leaks incorrect state to downstream consumers.

### Detection

- State is set in one code path but never reset in any other path
- The state transition lacks a reverse guard condition
- A `step()` or `update()` function advances state without checking whether preconditions still hold

### Fix: Bidirectional Guard

Add a reverse check at the top of the state update function, before the forward transition:

```
void state_update() {
    // Reverse guard: if preconditions are lost, go back
    if (state == Ready && error_is_active()) {
        state = Recovering;
    }
    // Forward transition
    if (state == Recovering && init_complete()) {
        state = Ready;
    }
}
```

Key principle: **If a target state's preconditions can become false while already in that state, define a reverse transition.**

## Async Flag Lifecycle Audit Checklist

When adding a new async operation (pending, in-progress, busy, data-ready flag):

- [ ] `init()` — Reset flag to known-safe
- [ ] `start()` — Set flag before triggering async work
- [ ] `stop()` — Reset flag
- [ ] `reset()` — Reset flag
- [ ] `recover()` — Reset flag
- [ ] `power_off()` — Reset flag
- [ ] Callback/timeout handler — Reset flag on completion

**Rule**: The cleanup must happen **before** any new operation is attempted, not after. Otherwise a stale flag can abort the new attempt in a brief race window.

## Derived State Invariant

**Pattern**: When resetting a primary state, also reset all derived/cached values that were computed from it. Otherwise cached values from the old state can satisfy preconditions for a transition that should be blocked.

**Example**: Resetting `display_state` to `WarmingUp` but leaving `cached_value = 42.0` (a valid measurement from the previous Ready state). A downstream check `if (cached_value > 0) → Ready` fires before the warmup timer starts, causing a one-frame Ready leak.

**Fix**: In every reset function, clear derived values alongside the primary state. Use a single reset entry point that handles both.
