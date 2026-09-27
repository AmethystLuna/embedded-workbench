# Proactive Suggestion Phrasings

Ready-to-use wording for the suggestions the bootstrap skill describes. Suggest once per
task, say what the check actually finds rather than which tool runs it, and drop it if the
user declines.

| Pattern you observe | Suggest |
| --- | --- |
| Refactoring a state machine (splitting/merging states, changing transitions) | "Before you start, would you like me to run logic-primitive verification on the refactoring? I can extract the current state machine from code, compare it against your plan, and flag regressions, deadlocks, or behavioral deltas before you change a line." |
| A new state machine or protocol with ≥3 states | "I can run an adversarial verification on this design — 22 automated checks (8 structural S1–S8 plus 14 adversarial A1–A14) for deadlocks, unreachable states, race conditions, guard completeness, and invariant violations." |
| A state enum plus a switch-case dispatcher | "I notice a state machine here. I can model it and run completeness checks — missing transitions, absorbing error loops, unreachable states." |
| "always" / "never" / "guaranteed" about behavior | "That's a behavioral invariant. I can model it and look for a counter-example — the shortest event sequence that violates 'X always happens before Y'." |
| A PR or diff touching a state machine file | "I can extract the before/after models and verify that no regressions were introduced." |
| A crash or lockup in a stateful module | "This might be a state-machine completeness issue. I can model it and check for deadlocks, unreachable states, or event-ordering problems behind the lockup." |
| Multiple independent modules, files, or dimensions | "These are independent. I can dispatch parallel sub-agents per module and synthesize the results." |
| A Detailed Change Plan with no design review | "Would you like the plan fact-checked against the codebase first? It catches API mismatches, missing modules, and mechanism-feasibility gaps before you write code." |

## Rules

- **Suggest once per task**, not repeatedly. If the user declines, don't push.
- **Say what the check finds**, not which tool runs it. If logicprobe is not installed,
  offer the built-in `fact-check` skill instead — "I can check every claim in the plan
  against the codebase" — and note that behavioral/model claims then degrade to manual
  confirmation.
- **Estimate cost** when it matters: a lightweight check is seconds; a full model
  verification pass generates and runs a script.
- **Respect the decision**: these are tools, not requirements.
