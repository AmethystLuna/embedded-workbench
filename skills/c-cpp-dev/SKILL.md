---
name: c-cpp-dev
description: "Use when writing, reviewing, or refactoring C/C++ code, especially on 32-bit ARM embedded targets. NOT for formatting-only changes, simple file reads, non-embedded C/C++ (desktop/server), or C#/Java despite the 'C' in the name."
---

<HARD-GATE>
This is a domain implementation skill. If you are planning, designing, or entering plan mode — load `Skill("embedded-workbench")` first to activate the workflow gates (Plan Verification Gate, Approval Gate, Closure Gate). Domain skills carry implementation guidance, not workflow enforcement.
</HARD-GATE>

# C/C++ Development

Language baseline is project-specific: check the project's CLAUDE.md, build system (`-std=` flags), or compiler configuration. All rules assume 32-bit ARM target unless otherwise noted.

## Code Generation

- Respect the project's configured language standard. Don't assume a default.
- When a header is shared between C and C++ translation units, never define variables in the header — not even with `static`. Use `extern` in the header and exactly one definition in a single `.c` file.
- Allow `goto` when it simplifies cleanup or reduces complexity, but use it as a maintenance tool, not a first choice.
- Place Doxygen comments in header files. Keep implementation files focused on behavior.
- Avoid inline functions in header files. Keep function definitions in source files so the interface stays small.
- In C, lightweight macros or helper wrappers are acceptable if simple, local, and clearly named.

## Memory Layout

- Watch local variable bursts inside functions. Large automatic arrays, structs, or many temporaries are stack budget items.
- Design structures with both semantics and byte alignment in mind. For protocol parsing, byte streams, and wire formats, make packing and endianness explicit.
- Use `pragma` or packing attributes only when they match a wire-format requirement and are documented clearly.
- Use double precision and 64-bit integers with caution on 32-bit targets. Operations on 64-bit objects create performance, compatibility, and atomicity problems unless the wider width is clearly required.
- When a 64-bit value crosses a task, interrupt, or module boundary, make its access pattern explicit: copied, split, guarded, or protected from tearing.

## Heap and Pointer Ownership

- Treat heap objects and pointer-owned state as lifetime-sensitive resources.
- Make ownership, release point, and invalidation rules explicit.
- Avoid retaining borrowed pointers longer than the lifetime that guarantees validity.
- For heap-backed or pointer-rich code, document invalidation conditions so future changes don't accidentally reuse stale objects.

## Embedded C Specifics

### Hardware Register Access

Memory-mapped peripheral registers must be `volatile` to prevent the compiler from optimizing away repeated reads or writes. Use a `volatile` struct pointer (the CMSIS/HAL pattern) rather than bare casts.

```c
// CORRECT: volatile pointer to peripheral struct
typedef struct {
    volatile uint32_t SR;   // Status  @ offset 0x00
    volatile uint32_t DR;   // Data    @ offset 0x04
    volatile uint32_t BRR;  // Baud    @ offset 0x08
    volatile uint32_t CR1;  // Control @ offset 0x0C
} UART_Regs;
#define UART2 ((UART_Regs *)0x40004400)

// BAD: missing volatile — compiler may optimize away repeated reads
#define UART_SR (*(uint32_t *)0x40001000)
while (UART_SR & TX_BUSY);  // May become infinite loop under optimization
```

### Linker Section Placement

Use `__attribute__((section(...)))` to place data and code in specific memory regions.

```c
// .noinit: value preserved across watchdog/system reset (not power-on reset)
uint32_t reset_reason __attribute__((section(".noinit")));

// .ramfunc: function kept in RAM for execution during flash programming
__attribute__((section(".ramfunc")))
void flash_program_word(uint32_t addr, uint32_t data) { /* ... */ }

// DMA-accessible buffer: must not be placed in CCM (tightly-coupled memory)
uint8_t dma_buffer[1024] __attribute__((section(".dma_ram")));
```

### ISR-Safe vs Non-ISR-Safe Path Separation

Keep the ISR path minimal and use separate wrapper functions for task-context work. Never call blocking APIs from an ISR.

```c
// ISR path: minimal, no blocking, use ISR-safe RTOS primitives
static void uart_rx_isr(void) {
    BaseType_t xHigherPriorityWoken = pdFALSE;
    xSemaphoreGiveFromISR(xUartSem, &xHigherPriorityWoken);
    portYIELD_FROM_ISR(xHigherPriorityWoken);
}

// Task path: can block, log, allocate, parse
void uart_rx_process_task(void) {
    if (xSemaphoreTake(xUartSem, portMAX_DELAY) == pdTRUE) {
        parse_and_dispatch(uart_rx_buf);
    }
}
```

### Cortex-M Fault Handler (naked)

The HardFault handler must be `__attribute__((naked))` to prevent the compiler's prologue from corrupting the stack pointer before the exception frame can be captured.

```c
// naked: no prologue — SP is the exact exception frame. Required for fault handlers.
__attribute__((naked)) void HardFault_Handler(void) {
    __asm volatile(
        "tst lr, #4\n"          // Check EXC_RETURN bit 2: MSP vs PSP
        "ite eq\n"
        "mrseq r0, msp\n"       // Thread used MSP → read from MSP
        "mrsne r0, psp\n"       // Thread used PSP (RTOS) → read from PSP
        "b HardFault_HandlerC\n"
    );
}
```

## Refactoring

- Keep the intent of the original code clear while changing structure. A refactor should improve cohesion, readability, or maintainability without quietly changing behavior.
- Skip smell-only changes that don't materially improve correctness, risk, maintainability, or clarity.
- Prefer small, focused extractions over broad rewrites. Split one responsibility at a time.
- Move a helper into shared code only when reuse is real and the dependency surface stays simple.
- If a block is short but semantically clear and reused in multiple places, extract it into an interface named by meaning, not implementation detail.
- If a C module has become difficult to keep readable without fighting the language, consider C++ refactoring — but ask the user before switching languages.
- When reshaping APIs or control flow, keep the normal, failure, and recovery paths intact. Re-validate all three after the change.
- If a refactor touches ownership, lifetime, or allocation, consult memory-layout guidance.
