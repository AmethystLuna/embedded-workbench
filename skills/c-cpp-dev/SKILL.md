---
name: c-cpp-dev
description: "Use when writing, reviewing, or refactoring C/C++ code, especially on 32-bit ARM embedded targets."
---

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

## Refactoring

- Keep the intent of the original code clear while changing structure. A refactor should improve cohesion, readability, or maintainability without quietly changing behavior.
- Skip smell-only changes that don't materially improve correctness, risk, maintainability, or clarity.
- Prefer small, focused extractions over broad rewrites. Split one responsibility at a time.
- Move a helper into shared code only when reuse is real and the dependency surface stays simple.
- If a block is short but semantically clear and reused in multiple places, extract it into an interface named by meaning, not implementation detail.
- If a C module has become difficult to keep readable without fighting the language, consider C++ refactoring — but ask the user before switching languages.
- When reshaping APIs or control flow, keep the normal, failure, and recovery paths intact. Re-validate all three after the change.
- If a refactor touches ownership, lifetime, or allocation, consult memory-layout guidance.
