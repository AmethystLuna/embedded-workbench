---
name: fact-check
description: "Use when reviewing design documents, architecture specs, technical proposals, or plans that make claims about API names, file paths, enum values, counts, or mechanism feasibility — a lightweight claim-by-claim check against the codebase with evidence. Built into embedded-workbench as the fallback when the full logicprobe plugin is not installed. NOT for state machines, protocol/retry logic, or 'always'/'never' behavioral claims that need executable model verification — those require the logicprobe plugin."
---

# Fact Check (fallback)

Lightweight claim verification built into this plugin. Use it when the full
`logicprobe` plugin is not installed — it checks every verifiable claim in a
document/plan against the codebase with evidence, without model escalation.

## When to use

- Design docs, architecture specs, technical proposals, refactoring plans
  that name APIs, types, files, enums, counts, or mechanisms.
- Proactively when a plan will be approved (plan-mode gate) and logicprobe is
  unavailable.

## What to verify (per claim)

| Claim type | Method |
|-----------|--------|
| Numeric claims (counts, sizes, frequencies) | `grep -c` / `grep -rn` |
| API/type/enum names | Extract actual signatures/values from headers |
| File paths and line numbers | Confirm existence and content |
| Mechanism feasibility | Check language standard / compiler support |

## Process

1. Enumerate every verifiable claim (quote it verbatim).
2. Verify each against the codebase with evidence (file:line + excerpt).
3. Output per claim: claim → evidence → verdict.

## Output format

- **Claim**: <verbatim quote>
- **Evidence**: <file:line + grep/read excerpt>
- **Verdict**: confirmed | refuted | unverifiable
- **Correction direction** (when refuted) — never fix inline.

Append a `## Plan Verification` block:

```markdown
## Plan Verification
- **Mode**: fact-check (fallback — logicprobe plugin not installed)
- **Claims checked**: [N] confirmed, [M] refuted, [K] unverifiable
- **Escalation**: model verification NOT run (requires logicprobe plugin)
```

## Boundaries

- **No executable model verification** — no state-space exploration, no harness.
- State machines (≥3 states), ACK/NACK/retry/timeout logic, lock/unlock
  ordering, and "always"/"never"/"guaranteed" claims require the `logicprobe`
  plugin: install it (see `.dsh/INSTALL.md`) or tell the user verification is
  degraded to manual mode for those claims.
- Checking a claim is not a security audit; being checked ≠ being safe.
