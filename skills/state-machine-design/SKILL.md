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

## Implementation Patterns

### Pattern A: Per-State Handlers + Unified Error Gate

Each state gets its own handler function. The dispatcher is a pure `switch(state)`. A unified fault-threshold check runs **after all** state handlers — no handler triggers the error transition itself. This keeps handlers simple and fault logic centralized.

```c
// === State enum: exactly one valid state at all times ===
typedef enum {
    COMM_STATE_INIT,
    COMM_STATE_IDLE,
    COMM_STATE_SAMPLE_STARTING,
    COMM_STATE_SAMPLING,
    COMM_STATE_ERROR,
    COMM_STATE_RECOVERING,
} comm_state_t;

// === Runtime context: all flags explicit in one struct ===
typedef struct {
    comm_state_t state;
    uint32_t     command_fail_count;
    bool         data_ready;
    bool         communication_lost;
} comm_runtime_t;

// === Per-state handlers: each reads only what it needs ===
static void comm_handle_idle(comm_runtime_t *rt) {
    rt->warmup_start_time = sys_tick();
    comm_start_sample();
    rt->state = COMM_STATE_SAMPLE_STARTING;
}

static void comm_handle_error(comm_runtime_t *rt) {
    static uint32_t retry_tick = 0;
    if (retry_tick == 0) {
        retry_tick = sys_tick();
        rt->data_ready = false;
    }
    comm_power_off();
    if (sys_tick() - retry_tick < 500) return;  // 500ms cooldown
    retry_tick = 0;
    rt->state = COMM_STATE_RECOVERING;
}

static void comm_handle_recovering(comm_runtime_t *rt) {
    comm_handle_initializing(rt);   // Recovery RE-USES init — no duplicated paths
}

// === Dispatcher: pure switch, single exit ===
static void comm_state_process(comm_runtime_t *rt) {
    switch (rt->state) {
    case COMM_STATE_INIT:            comm_handle_initializing(rt);   break;
    case COMM_STATE_IDLE:            comm_handle_idle(rt);           break;
    case COMM_STATE_SAMPLE_STARTING: comm_handle_sample_starting(rt);break;
    case COMM_STATE_SAMPLING:        comm_handle_sampling(rt);       break;
    case COMM_STATE_ERROR:           comm_handle_error(rt);          break;
    case COMM_STATE_RECOVERING:      comm_handle_recovering(rt);     break;
    default:
        rt->state = COMM_STATE_INIT;  // Unknown state → safe fallback
        break;
    }

    // Unified error gate: checked AFTER every state, not buried inside handlers.
    // A new state cannot accidentally bypass this check.
    if (rt->command_fail_count >= COMM_MAX_FAILS) {
        rt->state = COMM_STATE_ERROR;
        rt->command_fail_count = 0;
        rt->communication_lost = true;
    }
}
```

Key properties:

- **Fault logic is centralized** — the error gate runs exactly once, after every state. New states cannot bypass it.
- **Recovery reuses init** — `comm_handle_recovering()` calls `comm_handle_initializing()`. No duplicated paths to drift apart.
- **All exits are explicit** — `Error` has a cooldown period (500ms), then transitions to `Recovering`. No fall-through, no implicit assumption.
- **Unknown state → safe fallback** — the `default` case resets to `Init`.

### Pattern B: Function-Pointer Table Dispatch

Heavier than switch-case, but useful when states are added/removed frequently or handlers need different signatures.

```c
static const struct {
    comm_state_t state;
    void (*process)(void);
} comm_state_table[] = {
    {COMM_STATE_INIT,       comm_init_process},
    {COMM_STATE_IDLE,       comm_idle_process},
    {COMM_STATE_CONNECTED,  comm_connected_process},
    {COMM_STATE_ERROR,      comm_error_process},
    {COMM_STATE_RECOVERING, comm_recovering_process},
};

void comm_state_dispatch(void) {
    for (size_t i = 0; i < ARRAY_LEN(comm_state_table); i++) {
        if (g_comm_runtime.state == comm_state_table[i].state
            && comm_state_table[i].process != NULL) {
            comm_state_table[i].process();
            return;
        }
    }
    // Unknown state: reset to safe default
    g_comm_runtime.state = COMM_STATE_INIT;
}
```

### Pattern C: ACK Timeout With Explicit Retry Limit

All core rules in one function: timeout gated only when work is pending, explicit retry count, predefined max retries, all exits defined.

```c
static void comm_ack_check(uint32_t now_sec) {
    // GUARD: timeout logic only runs when there is real pending work
    if (!g_comm.report_in_progress) return;

    // GUARD: timeout hasn't expired yet
    if (elapsed_sec(g_comm.send_time, now_sec) < COMM_ACK_TIMEOUT_S) return;

    // Timeout fired. Explicit retry branch:
    if (g_comm.retry_count == 0) {
        g_comm.retry_count++;
        g_comm.send_time = now_sec;
        comm_send_report();                    // One automatic retry
        return;
    }
    // All retries exhausted → terminal exit
    g_comm.report_in_progress = false;
    g_comm.retry_count = 0;                    // Reset for next cycle
    comm_report_result(false);                 // Notify caller: failed
}
```

### Anti-Patterns

```c
// BAD: implicit state via flags — new flag creates untested state combinations
if (g_flags.busy && !g_flags.paused && g_flags.online) { ... }
// Fix: use explicit enum — exactly one valid state at all times

// BAD: idle state triggers timeout — retry fires with nothing pending
if (elapsed_ms(t0, now) > TIMEOUT) { retry(); }
// t0 is always running, even when no work is in flight

// BAD: retry loop with no exit condition
void retry_forever(void) {
    while (!send_packet()) { delay(100); }  // Will lock up if HW is dead
}

// BAD: recovery path duplicates init logic instead of reusing it.
// The copy drifts over time — one path gets a fix, the other doesn't.

// BAD: Error handler directly calls power_off() without cooldown period.
// Power-cycling faster than the hardware spec causes unpredictable state.
```

## When To Escalate

- When diagnostics point to an architecture-level or state-machine design defect, proactively offer high-level remediation focused on boundary clarity, lifecycle contracts, and reversible transitions — don't just propose ad-hoc runtime patches.

**REQUIRED SUB-SKILL:** If you find a state machine bug, also load `Skill("debug-methodology")` to apply structured root-cause analysis. If the bug involves async lifecycle flags or hardware events, load `Skill("embedded-firmware-dev")`. If the state machine lockup triggers a watchdog reset or HardFault, load `Skill("hardfault-triage")`.
