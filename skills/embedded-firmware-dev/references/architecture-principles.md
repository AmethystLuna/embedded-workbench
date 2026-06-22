# Embedded Architecture Principles

Design principles extracted from real embedded firmware architecture. Framework-agnostic, applicable across projects.

## 1. Three-Layer Ownership

```text
BSP (drivers)  →  Components (business logic)  →  GUI (presentation)
```

Dependencies flow downward. Lower layers never call upward.

| Layer | Owns | Never Owns |
| ------- | ------ | ------------ |
| BSP | Hardware registers, timing, raw sensor data | Business decisions, display logic |
| Components | State machines, policy decisions, data transformation | Pixel rendering, layout |
| GUI | Widget lifecycle, screen layout, user interaction | Hardware control, policy logic |

**Violation symptoms**: A GUI page directly setting PWM duty. A sensor driver computing display-ready values. A backlight module checking DND state.

**Fix**: Move the decision to the layer that owns the truth. Pass decisions downward as commands, upward as events.

## 2. Single Source of Truth

Every piece of runtime state has **exactly one** owning module.

```text
Source of Truth     →  Derived State      →  Cached State
(primary, canonical)   (computed from truth)  (snapshot for performance)
```

- **Source of truth**: The module that produces or receives the value first. Only this module writes it.
- **Derived state**: Computed from source of truth. Recalculated when source changes, not cached indefinitely.
- **Cached state**: Snapshot of derived state for performance. Must be invalidated when source changes.

**Rule**: If two modules both "own" a value, the architecture is wrong. Pick one owner. Other modules read or subscribe.

## 3. Pull Over Push

Prefer **pull mode** (sync on read) over **push mode** (periodic background write).

```text
Push (fragile):   Background task → write cache → consumer reads cache
Pull (robust):    Consumer reads → check source freshness → sync if stale → return
```

**Why**: In embedded systems, "sensor has data" and "cache is refreshed" are concurrent events. A push-based cache updater may not fire before the first consumer reads, producing stale or zero values.

**When push is OK**: High-frequency data where read-time sync is too expensive. But always pair with a freshness timestamp and stale-data fallback.

## 4. Atomic Event Consumption

For transient hardware events that multiple consumers need, use **check-and-clear**:

```c
bool consume_event() {
    bool occurred = event_latch;
    event_latch = false;  // Atomic clear
    return occurred;
}
```

Multiple consumers each call `consume_event()`. Each event is delivered to every interested consumer exactly once per occurrence.

**Anti-pattern**: A shared `bool event_happened` flag that Consumer A clears before Consumer B reads it. Or Consumer B reads a flag already set again by the next cycle.

## 5. Bidirectional State Transitions

Every state that has a forward path **must** have a reverse guard:

```text
Forward:  Idle → Active    (when start condition met)
Reverse:  Active → Idle    (when start condition lost)
```

**Rule**: If a target state's preconditions can become false while already in that state, define a reverse transition. One-way latches will eventually leak incorrect state.

**Check**: For every state variable, ask: "What makes it go back?" If there's no answer, you have a latent bug.

## 6. Lifecycle Completeness

Every async flag (pending, in-progress, busy, data-ready) must be cleared in **every** lifecycle path:

```text
init() → stop() → reset() → recover() → power_off()
  ✓        ✓         ✓          ✓           ✓
```

Missing one path = stale flag = next operation silently blocked with no error.

**Rule**: Cleanup must happen **before** any new operation starts, not after. Otherwise a brief window exists where the old flag aborts the new attempt.

## 7. Grace Windows for Transients

Mode switches, direction reversals, and re-initialization produce transient sensor perturbations. These are **not** genuine errors.

**Pattern**: Allow a bounded tolerance window (1-2 samples) after any mode transition before applying strict error thresholds.

**Without grace window**: First post-switch sample exceeds threshold → false error accumulation → unnecessary fault escalation.

**With grace window**: First 1-2 samples after transition are compared with relaxed thresholds. Steady-state samples use normal thresholds.

## 8. Single Computation Point for Display Strategies

When multiple UI pages need to decide "show value vs. show loading vs. show error":

```text
Anti-pattern:          Fixed:
Page A: if (x && !y)   compute_strategy(state, fault) → strategy
Page B: if (!y && x)   Page A: render(strategy)
Page C: if (x || z)    Page B: render(strategy)
```

One function owns the decision. Pages only render the result. This prevents:

- Subtle inconsistencies between pages
- New conditions added to some pages but not others
- Impossible-to-test combinatorial behavior

## 9. Minimal Root-Cause Fix

When you find the root cause, the fix is usually **1-2 lines at the data source**.

**Self-check**: If you're changing 5+ call sites to handle a problem, the fix is in the wrong place. Ask: what single state change would make all those call sites correct without modification?

**Example**: A cached value goes stale. Fix: invalidate the cache at the source when the primary value changes (1 line). Anti-pattern: add freshness checks at every consumer (5+ sites).

## 10. Module Boundary Respect

When debugging — before touching any code, map the ownership:

1. Which module owns the truth?
2. Which module derives policy from it?
3. Which modules only consume?

**Rule**: Fix the module that owns the truth. Don't patch consumers.

**Example**: A display page showing stale sensor data. The sensor component owns the measurement truth. The display strategy computation owns the loading/error/ready decision. Fix: recompute display strategy when sensor state changes. Don't add per-page staleness checks.

## 11. Layout and Logic Separation

GUI pages must separate **what to show** from **how to show it**.

```c
// Anti-pattern (mixed):
page_poll() {
    value = sensor_read();
    if (value > threshold) {
        lv_label_set_text(label, "High");
        lv_obj_set_style_bg_color(screen, red, 0);
    }
}

// Fixed (separated):
display_model_t model = compute_display_model(sensor_read());
page_render(model);  // Only sets widgets, no logic
```

**Rules**:

- Widget creation and styling (`Setup()`) lives in one function. Business logic lives in another.
- State polling and decision-making return a **display model** struct. The render function consumes it mechanically.
- No `if (business_condition)` inside a `lv_obj_set_*()` call. Conditions are resolved before rendering.
- A render function should be callable with any valid display model and produce correct output without knowing how the model was computed.

**Why**: Mixed layout and logic means changing a widget position risks breaking business rules, and changing a threshold risks breaking layout. Separation makes each side testable independently.

## 12. UI Decoupling from Lower Layers

GUI pages must not directly call component or BSP APIs. All data flows through a **presentation interface**.

```c
// Anti-pattern (coupled) — Page_Sensor.c:
raw = bsp_i2c_read(0x52, 0x00);  // GUI calling BSP directly
co2 = raw * 0.01;                 // GUI doing data transformation
if (co2 > 2000) { ... }           // GUI owning business thresholds

// Fixed (decoupled) — Page_Sensor.c:
data = env_monitor_get_display_data(SENSOR_CO2);
render_display_model(data);
```

**Presentation interface design**:

- Returns pre-processed, display-ready values (no raw ADC counts, no protocol-level flags)
- Hides whether the data source is local (I2C sensor) or remote (inter-processor protocol from another device)
- Provides a **display strategy** enum (Ready / Loading / Error / NotApplicable) — the page consumes the strategy, doesn't compute it
- Single entry point per data domain: `xxx_get_display_data()` rather than 5 different getters

**Benefits**:

- Sensor protocol changes don't touch GUI code
- Pages work identically whether data comes from local sensor or remote device
- Pages can be tested with mock display data without hardware
- New pages for the same data domain reuse the same presentation interface

**Migration path** (when inheriting a coupled codebase):

1. Identify all component/BSP calls in GUI files
2. Group them by data domain (sensor, motor, fault, etc.)
3. For each domain, create a thin `xxx_get_display_data()` wrapper
4. Move data transformation logic from GUI into the wrapper
5. Replace direct calls in pages with the wrapper
6. Once all pages use the wrapper, refactor the wrapper's internals freely
