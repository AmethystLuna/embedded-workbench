# AGENTS.md

Agent and contributor guide for the Embedded Engineering Workflow plugin. This
file is the single source. `CLAUDE.md` only points here, because Claude Code looks
for that name by convention.

## Writing Rules

These apply to every file this repository ships, injects or publishes, and to the
text of a store entry. They come from the review that produced the current text.

- **Short sentences, one idea each.** The reader does not have the author's
  context. A sentence that needs a second clause to make sense should be two.
- **No brittle counts.** Never write how many tools, checks, skills or agents
  exist. A release changes the number and the sentence silently becomes wrong.
  Name the thing instead.
- **One job per file.** Injected text is a guide to working in this plugin. A
  `SKILL.md` carries doctrine and routing. `agents/*` defines one agent role.
  `references/*.md` carries per-domain detail. The README tells the human story.
  Manifests describe capability. `DSH-COMPATIBILITY.md` holds measured evidence.
  State a fact in one place and point at it from everywhere else.
- **No dangling pointers.** Every path, flag, skill and tool a file names must
  exist and be reachable from that file. A named command that no artifact
  implements is worse than no mention: the reader goes looking for it. Paths
  resolve from where the reader runs, not from the plugin root.
- **Spend the budget.** Injected text is paid once per session and mode context
  once per turn. Keep the top level lean and put detail behind a pointer.
- **Say what it does not prove.** Every scope claim needs its non-goal beside it.
  A diagnostic that narrows a fault has not localized it, and the text must say so.
- **The Red Flags and the 1% Rule stay.** In injected text they are not
  documentation. They change how often the model reaches for a skill or a tool, so
  they survive every trim.
- **Descriptions stay factual.** Store and manifest descriptions state what the
  plugin does. Slogans live in the README and the injected text, never in an entry
  description.
- **Bilingual pairs move together.** A Chinese document and its English
  counterpart change in the same commit.

## Acknowledgments

This plugin's agent-compliance architecture (1% Rule, Red Flags, `<SUBAGENT-STOP>`,
instruction priority, skill types, session-start hook injection) is adapted from
[Superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT License).
The trigger test framework structure (`tests/skill-triggering/`) follows
Superpowers' testing conventions.

## DSH Plugin Conventions

- **Compatibility is measured, never assumed.** `dsh.compatibility.dshReleases`
  gains `compatible` for a release only after a round on it: install, mount, the
  offline checks, uninstall. Dependabot is restricted to devDependencies for that
  reason. A peer range is a claim, and automation must not widen it.
- **No Python ships in the package.** The Keil skill's build path is Keil's own
  `UV4.exe`; a CI reimplementation has to replicate its stages itself.
- **A client bundle does not load Harness Client packages.** Vendor the control,
  give its classes a plugin prefix, and use the host's design tokens only. A
  plain-JS bundle gets no type check, and a throw blanks the whole slot entry.
- **The Claude-side hook** JSON-escapes its payload in pure bash and resolves
  paths from its own location. `hooks.json` timeouts are in seconds, not
  milliseconds.

## Host Alignment

This plugin runs on Claude Code, Codex, Cursor, Kimi, OpenCode, ZCode and dsh. A
feature is not done for one host only.

- **Every host surface moves together.** A new skill or agent needs its routing
  line in the bootstrap skill, its mention in the injected text, its row in the
  README tables, and whatever the host manifests declare. A skill only dsh can
  reach is a bug, not a shortcut.
- **The injected text is one contract.** The dsh gate is the native adaptation of
  `hooks/session-start-content.md`. Change the behaviour rules in both.
- **No catalogue counts in shipped text.** "4 agents, 8 skills" is wrong the
  moment a fifth agent lands. Name the capability instead. Manifest
  descriptions, storefront copy and README summaries are all in this category.
- **No host-specific paths in skill text.** Hosts disagree about where a plugin
  lives. Resolve a path at runtime, from the script's own location.
- **dsh is one host, not the only one.** A change that works only because dsh
  supplies a service needs a Claude-side and a plain-file answer too, or it must
  say plainly that the host has to supply that service.

## PR Requirements

- All PRs must pass `markdownlint` with the project's `.markdownlint.json` config.
- New skills must follow the established frontmatter format: `name` (kebab-case),
  `description` ("Use when..." format).
- Agent changes must maintain the tool allowlist (`tools` field):
  - Read-only agents (`architecture-steward`, `quality-coordinator`) must not gain
    Write or Edit.
  - Review agents (`design-reviewer`) may include Bash for read-only verification
    (grep, markdownlint, build checks) — add explicit "Bash for verification only"
    guidance in the agent prompt.
  - Implementation agents (`execution-worker`) require Write + Edit + Bash.
- Skill content must not hardcode project-specific details (file paths, version
  numbers, product names).
- Chinese content should have English equivalents in the bootstrap skill and vice
  versa.

## Before Submitting

- Run `markdownlint` on all changed files.
- Run the offline checks:
  - `node tests/dsh-gate-injection.test.mjs` — drives the committed `lib/` output
    against a stub context and asserts the gate enters a session exactly once.
    Self-contained, so CI runs it too; if you change the injection or its history
    guard, this is the test that has to move with you.
  - `node tests/dsh-client-half.test.mjs` — loads the built `lib/client.js` through
    a `window.__ModuleLoader__` stub and drives the Plugins-page switch with fake
    React primitives, a fake settings form and a fake slot registry. `tsc` never
    sees the hand-authored client bundle, so this is its only check. Self-contained,
    and CI runs it.
  - `node tests/claude-session-start-hook.test.mjs` — runs the SessionStart hook
    over control-character, CRLF and Unicode payloads and asserts the emitted JSON
    is valid and byte-exact. Also self-contained, and it is the guard for the
    escaper: run it after touching `hooks/`. CI runs it on Linux, whose GNU sed/awk
    differ from the Git Bash tools on Windows.
  - `node tests/dsh-skills-registration.test.mjs` — mounts the real `SkillRegistry`
    and checks the shipped catalog. It imports the `logicprobe` checkout as a
    sibling directory, so it is local-only and CI does not run it.
- Verify `plugin.json` passes `claude plugin validate`.
- Test the plugin locally by installing to `~/.claude/plugins/dev/`.
- Bump the version with the release tool: `npm run bump -- <new-version>`
  (syncs every declared manifest — `package.json`, `package-lock.json` ×2, all
  plugin manifests, `.version-bump.json` — plus `DSH-COMPATIBILITY.md`;
  `npm run bump -- --check` and `npm run bump -- --audit` must pass).

## CI Workflows (GitHub Actions)

- `dsh-bundle` — on push/PR touching `src/`, `lib/`, `skills/`, `agents/`,
  `hooks/`, `tests/`, `.dsh/`, `AGENTS.md`, `cordis.patch.yml`, `package.json`,
  `package-lock.json`, `tsconfig.json`, the READMEs, or the workflow itself:
  `npm ci --legacy-peer-deps`, typecheck, build, committed-`lib/` drift guard, the
  offline plugin checks (gate injection, browser-half switch, SessionStart hook
  payload), and repo-wide markdownlint (`npx markdownlint-cli --ignore "**/node_modules/**" .`).
- `Plugin Security Scan` — on every push/PR: `hashgraph-online/ai-plugin-scanner-action`
  on the repo root; fails on high-severity findings.

## Release Workflow (pre-release checklist)

The full checklist is in `RELEASE.md`; the short version:

- **Version policy**: patch for fixes/docs/deps/CI, minor for new features, major
  for breaking changes. Never bump "just because something changed".
- **Bump**: `npm run bump -- <new-version>`, then `npm run bump -- --check` and
  `npm run bump -- --audit` must pass.
- **Lint**: `npx markdownlint-cli --ignore "**/node_modules/**" .` passes.
- **Bundle**: `npm ci --legacy-peer-deps && npm run typecheck && npm run build && git diff --exit-code -- lib`.
- **Local mount**: `dsh plugin --profile scratch add "file:$PWD"` and
  `--dump-config` shows the row.
- **Ship**: push → CI green → `npm publish` → verify the published artifact on a
  scratch `DSH_HOME` → tag `vX.Y.Z` and push tags.
- **Tags move only on explicit instruction.** Moving a published tag is a force
  push; say so before doing it, and never move one to carry an unrelated change.

## Plugin Store Compliance Checklist

Concrete requirements that must stay true for this plugin's store entries (merged
from the store forks this plugin is listed in):

- [ ] `package.json` declares `dsh.bundle.patch` — a manifest with only
  `dsh.client` is not installable and gets rejected.
- [ ] Package name uses a namespace you control; never `@deepseek-ai/*` (official
  packages appear only as `peerDependencies`).
- [ ] Official `@deepseek-ai/*` packages are `peerDependencies` with explicit
  prerelease `||` branches; every runtime dependency is declared.
- [ ] Repo is public, carries the `dsh-plugin` topic, is at least 1 day old with
  ≥10 commits, and is actively maintained.
- [ ] Entry description is accurate and functional — no superlatives or
  marketing; any counts, API names, or commands it names actually exist.
- [ ] Category matches what the plugin does (`skill` for both plugins).
- [ ] Entry metadata matches the repo: exact GitHub URL/name, `version` matches
  the manifest at the pinned commit, `entryIds` match the bundle patch.
- [ ] Lifecycle scripts (`preinstall`/`install`/`postinstall`/`prepare`) are
  declared and disclosed; no surprising install-time behavior.
- [ ] Never disable, replace, or duplicate `@deepseek-ai/*` official components;
  never modify DSH core.
- [ ] No hardcoded secrets, credential exfiltration, destructive commands, miner
  patterns, or obfuscated source.
- [ ] `dsh.compatibility.dshReleases` declares per-release `compatible` or
  `unknown`; an approved entry keeps a precise `compatible` for at least one of
  the latest three DSH releases; version bumps reset old-version evidence.
- [ ] Storefront Chinese fields: `name` uses `中文名（English Name）`, description
  includes a Chinese purpose, `searchTerms` includes Chinese aliases.
- [ ] README covers overview, compatibility, install/uninstall, quick start,
  configuration, permissions & data, troubleshooting, development, and
  license/security.
- [ ] Entry updates touch only your own entry; generated READMEs are regenerated,
  never hand-edited.
