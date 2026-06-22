---
name: fact-verification
description: "Use when reviewing design documents, architecture specs, or technical proposals that make claims about API names, file locations, enum values, or mechanism feasibility."
---

# Fact Verification

Documents are not truth — code is. Verify every verifiable claim before accepting or acting on any design.

## Methodology

### Phase 1: Enumerate Claims

Read the document fully. Extract every claim that is verifiable:

- Numeric claims (counts, sizes, frequencies)
- API/type/enum names
- File paths and line numbers
- Mechanism descriptions ("compile-time resolution", "static dispatch")

### Phase 2: Verify Against Codebase

For each claim, run the relevant verification:

- **Numeric claims**: `grep -c` or `grep -rn` to get the real count
- **API/type names**: extract actual signatures from headers
- **Enum/constant values**: list actual values from BSP/config headers
- **Mechanism feasibility**: check language standard and compiler support

### Phase 3: Gap Analysis

Classify findings by severity:

1. **Architecture-level**: claims that make the design unimplementable (fake APIs, missing modules)
2. **Mechanism-level**: claims the language/compiler cannot fulfill
3. **Consistency-level**: internal contradictions across documents

### Phase 4: Root Cause

For each error, identify why it happened:

- Wrong mental model (C++ constexpr thinking in C99)?
- Incomplete search scope?
- Copy-paste from other projects without verification?
- Misunderstanding of compiler/linker behavior?

### Phase 5: Structured Output

Each finding includes:

- Exact location (file:line or section)
- What the document claims
- What the codebase actually contains (with evidence — grep output, line numbers)
- Correction direction

## Rules

1. Never trust a document's claim without codebase verification.
2. Be honest about mechanism boundaries — if the language standard can't do it, say so.
3. Cite evidence with specific file:line references.
4. Don't fix during review — point the way, let implementation happen after approval.
