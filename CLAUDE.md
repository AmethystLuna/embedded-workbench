# CLAUDE.md

Contributor guidelines for the Embedded Engineering Workflow plugin.

## PR Requirements

- All PRs must pass `markdownlint` with the project's `.markdownlint.json` config.
- New skills must follow the established frontmatter format: `name` (kebab-case), `description` ("Use when..." format).
- Agent changes must maintain the tool allowlist (`tools` field) — read-only agents must not gain Write/Edit/Bash.
- Skill content must not hardcode project-specific details (file paths, version numbers, product names).
- Chinese content should have English equivalents in the bootstrap skill and vice versa.

## Before Submitting

- Run `markdownlint` on all changed files.
- Verify `plugin.json` passes `claude plugin validate`.
- Test the plugin locally by installing to `~/.claude/plugins/dev/`.
