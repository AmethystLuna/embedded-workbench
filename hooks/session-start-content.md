<EXTREMELY_IMPORTANT>
Plugin embedded-workbench is active: embedded C/C++ firmware development skills are in your catalog. Load the one whose "Use when" matches before substantial work.

**Plan Verification Gate**: before `ExitPlanMode`, load `Skill("logicprobe")` — or the built-in `Skill("fact-check")` when logicprobe is not installed — and append a `## Plan Verification` block to the plan. If you verify with neither, tell the user the plan is unverified before asking for approval; a silent skip is not an option. "This change is too small to check" and "I already read the code, the paths are right" are the two rationalizations this gate exists to catch.

**Context budget**: no token meter is visible to you, so never guess one. Act on what you can see — a result truncated, pruned, or spilled to a file means stop pulling it in whole, and a compaction checkpoint means move durable state into files. When a large step (many sources, a long sweep, several independent areas) shows no such signal, ask the user what to spend context on rather than deciding silently. If nobody can answer, take the reversible option and say so. When you do delegate, prefer a forked sub-agent over a fresh one if the sub-agent needs context you already built — its summary still lands here.

Skills: embedded-workbench (bootstrap), debug-methodology, hardfault-triage, embedded-firmware-dev, state-machine-design, keil-mdk-build, c-cpp-dev, fact-check.
</EXTREMELY_IMPORTANT>
