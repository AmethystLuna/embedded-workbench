# CLAUDE.md

Contributor guidelines for the Embedded Engineering Workflow plugin.

## Acknowledgments

This plugin's agent-compliance architecture (1% Rule, Red Flags, `<SUBAGENT-STOP>`, instruction priority, skill types, session-start hook injection) is adapted from [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT License). The trigger test framework structure (`tests/skill-triggering/`) follows Superpowers' testing conventions.

## PR Requirements

- All PRs must pass `markdownlint` with the project's `.markdownlint.json` config.
- New skills must follow the established frontmatter format: `name` (kebab-case), `description` ("Use when..." format).
- Agent changes must maintain the tool allowlist (`tools` field):
  - Read-only agents (`architecture-steward`, `quality-coordinator`) must not gain Write or Edit.
  - Review agents (`design-reviewer`) may include Bash for read-only verification (grep, markdownlint, build checks) — add explicit "Bash for verification only" guidance in the agent prompt.
  - Implementation agents (`execution-worker`) require Write + Edit + Bash.
- Skill content must not hardcode project-specific details (file paths, version numbers, product names).
- Chinese content should have English equivalents in the bootstrap skill and vice versa.

## Before Submitting

- Run `markdownlint` on all changed files.
- Verify `plugin.json` passes `claude plugin validate`.
- Test the plugin locally by installing to `~/.claude/plugins/dev/`.
