# DSH Compatibility Evidence — Embedded Workbench

Evidence for the DSH STORE fixed-Commit contract (author-remediation notice
[AI-Scarlett/DSH-Store#251](https://github.com/AI-Scarlett/DSH-Store/issues/251)):
per-release install / start / uninstall verification of this plugin's native
dsh bundle against the DSH releases listed in `dsh.compatibility.dshReleases`.

## Environment

| Item | Value |
|---|---|
| Host | Windows 11 (x64), build 19045 |
| Node.js | v24.17.0 |
| npm | 11.13.0 |
| pnpm | 11.21.0 |
| Test date | 2026-09-25 |
| Package under test | `dsh-embedded-workbench` 0.8.13 (bundle patch `cordis.patch.yml`, entry id `embedded-workbench`) |

## Method (one disposable profile per version)

Each DSH release was run from its own runtime (global CLI for
0.1.0-rc.7 … 0.1.2-alpha.3; temporary npm install under an isolated prefix for
0.1.2-alpha.4 through 0.1.7-rc.2) against a fresh `DSH_HOME`, so no state
leaked between versions. 0.1.3-alpha.1 predates its npm publish, so it ran from
a local pnpm workspace build of git tag `dsh-v0.1.3-alpha.1`; every later row was
installed from its published npm release. The `fs-ext` native dependency
introduced in 0.1.3 (cross-process session write lease) is a POSIX `flock` shim
that the Windows lease path never calls — it takes a kernel semaphore instead —
so the two 0.1.3 rows ran with `fs-ext` substituted by a no-op stub on this
MSVC-less host (`npm install --ignore-scripts`). 0.1.5-alpha.1 replaced `fs-ext`
with the lazily loaded prebuilt `@deepseek-ai/node-addon-system/flock`, so that
row installed exactly as published.

```bash
# 1) install: fresh profile, plugin added as a file: dependency
dsh plugin --profile headless add "file:<this-repo>"      # pnpm add succeeds

# 2) mount check: composed tree contains the plugin row, enabled
dsh --profile headless --dump-config                       # id: embedded-workbench / enabled: true

# 3) start: headless boot with a deliberately invalid API key.
#    Expected: tree mounts and the app reaches the model-provider stage,
#    failing only with AUTH for the fake key; no plugin load errors.
DEEPSEEK_API_KEY=fake-key-for-boot-test dsh --profile headless "reply OK"

# 4) uninstall: plugin removed, row gone from the composed tree
dsh plugin --profile headless remove dsh-embedded-workbench
dsh --profile headless --dump-config                       # no embedded-workbench row
```

The headless `AUTH` rejection proves the profile booted with the plugin applied
(any bundle apply error would surface before the provider call). End-to-end
model calls were not exercised (no real provider key used).

Every row re-run in this round also asserts that the install and the boot were
**not** refused by the plugin-compatibility preflight that DSH 0.1.7-rc.1
introduced (see Notes): `dsh plugin add` must not report the named package as
incompatible, `--dump-config` must not contain a `disabling profile plugin`
line, and the boot must not contain `incompatible` or `skipping profile bundle`.
The preflight only exists on 0.1.7-rc.1 and later, so the 0.1.7-rc.1 and
0.1.7-rc.2 rows are the ones that actually exercise it; on the older rows the
same assertions only confirm the refusal wording is absent. The pre-install check
is evaluated from this package's `peerDependencies`.

Since 0.8.13 each row is further inspected at the session-log level with a
format-agnostic scanner (`seam-scan.mjs`) that decompresses every zstd frame and
asserts two seams at once: the injected gate landed as a `user/message` carrying
this producer's message source, and an `embedded-workbench` entry reached the
session skill catalog. All six runtimes re-verified in this round (0.1.5-rc.3,
0.1.6-alpha.2, 0.1.7-alpha.1, 0.1.7-alpha.2, 0.1.7-rc.1, 0.1.7-rc.2 × both
plugins) passed 12/12, recording session format v3 on 0.1.5-rc.3 and
0.1.6-alpha.2 and v4 on the four 0.1.7 releases.

For the 0.1.3-alpha.2 row the boot was additionally inspected at the session-log
level: the persisted v2 log (`session.v2.jsonl.zstd`) records the injected gate
as a `user/message` event with `data.source = {"kind":"plugin",
"plugin":"embedded-workbench"}`. That proves the `agent/pre-step` hook ran and
its `Session` snapshot read resolved on the new release. The 0.1.5-alpha.1 row
repeated that inspection against the v3 log (`session.v3.jsonl.zstd`, a
multi-frame zstd stream): the gate is recorded the same way and the rendered
prompt now lives in a `system/message` surface node. The 0.1.5-alpha.2, 0.1.5-rc.1, 0.1.5-rc.2, 0.1.6-alpha.1 and 0.1.6-alpha.2 rows repeated the same v3 inspection with the same result. The 0.1.7-alpha.1 row inspected the v4 log (`session.v4.jsonl.zstd`): the gate is recorded as a `user/message` whose source is now the producer-owned `{"kind":"plugin:embedded-workbench"}` (see Notes), and the rendered prompt still arrives as a `system/message` surface node. The 0.1.5-rc.3, 0.1.6-alpha.2 and 0.1.7-alpha.1 regression rows and the 0.1.7-alpha.2, 0.1.7-rc.1 and 0.1.7-rc.2 new rows repeated that inspection with a format-agnostic scanner that matches the gate source and the skill-catalog entry on both the v3 and v4 log shapes.

## Results

| dsh release | install | dump-config row | start (headless boot) | uninstall |
|---|---:|---:|---:|---:|
| 0.1.0-rc.7 | pass | pass | pass (AUTH-only) | pass |
| 0.1.0-rc.8 | pass | pass | pass (AUTH-only) | pass |
| 0.1.1-rc.1 | pass | pass | pass (AUTH-only) | pass |
| 0.1.1-rc.2 | pass | pass | pass (AUTH-only) | pass |
| 0.1.2-alpha.2 | pass | pass | pass (AUTH-only) | pass |
| 0.1.2-alpha.3 | pass | pass | pass (AUTH-only) | pass |
| 0.1.2-alpha.4 | pass | pass | pass (AUTH-only) | pass |
| 0.1.2-alpha.5 | pass | pass | pass (AUTH-only) | pass |
| 0.1.2-rc.1 | pass | pass | pass (AUTH-only) | pass |
| 0.1.3-alpha.1 | pass | pass | pass (AUTH-only) | pass |
| 0.1.3-alpha.2 | pass | pass | pass (AUTH-only) | pass |
| 0.1.5-alpha.1 | pass | pass | pass (AUTH-only) | pass |
| 0.1.5-alpha.2 | pass | pass | pass (AUTH-only) | pass |
| 0.1.5-rc.1 | pass | pass | pass (AUTH-only) | pass |
| 0.1.5-rc.2 | pass | pass | pass (AUTH-only) | pass |
| 0.1.5-rc.3 | pass | pass | pass (AUTH-only) | pass |
| 0.1.6-alpha.1 | pass | pass | pass (AUTH-only) | pass |
| 0.1.6-alpha.2 | pass | pass | pass (AUTH-only) | pass |
| 0.1.7-alpha.1 | pass | pass | pass (AUTH-only) | pass |
| 0.1.7-alpha.2 | pass | pass | pass (AUTH-only) | pass |
| 0.1.7-rc.1 | pass | pass | pass (AUTH-only) | pass |
| 0.1.7-rc.2 | pass | pass | pass (AUTH-only) | pass |

## Declared compatibility (package.json)

```json
"engines": { "node": ">=20" },
"dsh": {
  "engines": { "dsh": ">=0.1.0-rc.7" },
  "compatibility": {
    "dsh": "^0.1.0-rc.7 || ^0.1.1-rc.1 || ^0.1.2-alpha.2 || ^0.1.2-alpha.3 || ^0.1.2-alpha.4 || ^0.1.2-alpha.5 || ^0.1.2-rc.1 || ^0.1.3-alpha.1 || ^0.1.3-alpha.2 || ^0.1.5-alpha.1 || ^0.1.5-rc.1 || ^0.1.5-alpha.2 || ^0.1.5-rc.2 || ^0.1.5-rc.3 || ^0.1.6-alpha.1 || ^0.1.6-alpha.2 || ^0.1.7-alpha.1 || ^0.1.7-alpha.2 || ^0.1.7-rc.1 || ^0.1.7-rc.2",
    "dshReleases": {
      "0.1.0-rc.7": "compatible",
      "0.1.0-rc.8": "compatible",
      "0.1.1-rc.1": "compatible",
      "0.1.1-rc.2": "compatible",
      "0.1.2-alpha.2": "compatible",
      "0.1.2-alpha.3": "compatible",
      "0.1.2-alpha.4": "compatible",
      "0.1.2-alpha.5": "compatible",
      "0.1.2-rc.1": "compatible",
      "0.1.3-alpha.1": "compatible",
      "0.1.3-alpha.2": "compatible",
      "0.1.5-alpha.1": "compatible",
      "0.1.5-alpha.2": "compatible",
      "0.1.5-rc.1": "compatible",
      "0.1.5-rc.2": "compatible",
      "0.1.5-rc.3": "compatible",
      "0.1.6-alpha.1": "compatible",
      "0.1.6-alpha.2": "compatible",
      "0.1.7-alpha.1": "compatible",
      "0.1.7-alpha.2": "compatible",
      "0.1.7-rc.1": "compatible",
      "0.1.7-rc.2": "compatible"
    },
    "profiles": ["headless"]
  }
}
```

## Notes

- DSH 0.1.2-alpha.4 removed the `Session.events` getter and replaced it with
  on-demand reads (`seq` / `eventAt()` / `snapshotEvents()`). 0.8.5 reads
  session history through a version-adaptive helper (`readSessionEvents`) that
  prefers `snapshotEvents()` when present and falls back to the `events`
  snapshot on earlier releases, so the gate injection keeps working on every
  declared DSH release. Regression-checked with harnessed `agent/pre-step`
  runs against both session event-source shapes (12/12 pass) in addition to
  the per-release boot matrix above.
- DSH 0.1.2-alpha.5 (session-projection cache v6 read compatibility and
  storage salvage) and 0.1.2-rc.1 (release-candidate stabilization on top of
  alpha.5) do not change the plugin-facing seams this bundle relies on
  (`agent/pre-step`, `Session` event reads, `ctx.tools`/provider
  registration); verified per release with the disposable-profile matrix above
  (0.8.4 keeps 0.1.0-rc.7 … 0.1.2-rc.1 working).
- DSH 0.1.3-alpha.1 (session format v2 with released migration, embedded
  assistant streams, and the new `agent/assistant-stream` live event) does not
  change the plugin-facing seams this bundle relies on (`agent/pre-step`,
  `Session` snapshot event reads, `ctx.skills`/provider registration);
  `assistant/chunk` log events were removed in v2 but this bundle never reads
  them. Verified per release with the disposable-profile matrix above (0.8.5
  keeps 0.1.0-rc.7 … 0.1.3-alpha.1 working). The 0.1.3-alpha.1 row ran a local
  source build of the git tag with the new `fs-ext` native dependency stubbed
  out on this no-MSVC host (see Method); 0.1.3-alpha.2 re-verified the same
  seams from the published npm release.
- DSH 0.1.3-alpha.2 (persona configuration split into prefix/suffix, default
  read/write/edit file tools for SDK/Headless/ACP, and subprocess handles
  dropping `pid`) renames `PERSONA_SECTION` to `PERSONA_PREFIX_SECTION` and
  replaces `Config.persona` with `personaPrefix`/`personaSuffix`, but this
  bundle never reads the persona slot and touches neither subprocess handles nor
  the `agent/pre-step` / `Session` snapshot seams. `Session.fromRestore` gained
  a fifth `eventState` parameter and `dsh-session` dropped its internal
  `chunk-rows` exports; this bundle uses neither. Verified with the
  disposable-profile matrix above plus the session-log gate evidence (0.8.6
  keeps 0.1.0-rc.7 … 0.1.3-alpha.2 working).
- DSH 0.1.5-alpha.1 (session format v3, the `system/message` surface node that
  now carries the rendered system prompt, the released v2-to-v3 migration, the
  `tool/code-dispatch*` → `tool/ptc-dispatch*` rename, and stricter event
  validation) does not change the plugin-facing seams this bundle relies on
  (`agent/pre-step`, `Session` snapshot event reads, `ctx.skills`/provider
  registration). The stricter validation constrains only `request/header` and
  `tool/result`, while `user/message` still projects verbatim, so the injected
  gate remains valid. `fs-ext` was replaced by the lazily loaded prebuilt
  `@deepseek-ai/node-addon-system/flock`, so this row installed from the
  published npm release as-is. Verified with the disposable-profile matrix plus
  the v3 session-log gate evidence (0.8.7 keeps 0.1.0-rc.7 … 0.1.5-alpha.1
  working).
- DSH 0.1.5-rc.1 (release-candidate stabilization over alpha.1: 198 commits
  dominated by Web/Client sidebar, file-preview, diagram and workspace-files
  work; additive `deliverables/presented` and `subagent/catalog` event types;
  an optional `LlmConfigurableProvider.error` diagnostic; `chokidar` added to
  app-boot) keeps session format v3 and leaves the `agent/pre-step`, `Session`
  snapshot, `ctx.skills`/provider registration and `createUserMessage`
  seams unchanged. Verified with the disposable-profile matrix plus the v3
  session-log gate evidence (0.8.8 keeps 0.1.0-rc.7 … 0.1.5-rc.1 working).
- DSH 0.1.5-alpha.2 (185 commits on the same Web/Client stabilization line;
  its plugin-facing delta matches the rc.1 row) and 0.1.5-rc.2 (a two-commit
  version-bump-only release over rc.1) keep session format v3 and leave the
  `agent/pre-step`, `Session` snapshot,
  `ctx.skills`/provider registration and `createUserMessage`
  seams unchanged. Verified with the disposable-profile matrix plus the v3
  session-log gate evidence (0.8.9 keeps 0.1.0-rc.7 … 0.1.5-rc.2 working).
- DSH 0.1.6-alpha.1 (550 non-merge commits over rc.2: a large Web/Client
  push, the `llm-deepseek` split into `chat-completions`/`messages` protocol
  adapters, the `code-runtime` → `ptc-runtime` rename, and new `ssh` /
  browser-use / MCP-resources packages) keeps session format v3
  (`SESSION_FORMAT_VERSION` is still `3`) and leaves the plugin-facing seams
  this bundle relies on unchanged: `agent/pre-step` is unchanged from 0.1.5-rc.2
  (same payload and an unchanged `PreStepDecision` contract),
  `ctx.skills`/provider registration, `systemPrompt.context` (only an additive
  optional `interpolate` flag) and `createUserMessage` keep their signatures.
  `Session.snapshotEvents()` / `eventAt()` / `ownEvents()` are marked
  `@deprecated` for new callers but still behave identically, so the
  version-adaptive `readSessionEvents` helper keeps working. The new
  `image/offload` event type requires a `SessionMessageProjection` interpreter
  from its owning plugin; this bundle emits no session events, so it registers
  none. The renamed `Session.surface.replaceGeneration` → `contentGeneration`
  and `dsh-llm`'s `AssistantProvenance` → `AssistantProviderMetadata` are not
  referenced by this bundle. Verified with the disposable-profile matrix plus the
  v3 session-log gate evidence (0.8.10 keeps 0.1.0-rc.7 … 0.1.6-alpha.1 working).
- DSH 0.1.6-alpha.2 (548 non-merge commits over alpha.1: the new
  `boot/plugin-manager`, `boot/hmr` and `client/ui-plugin-manager` packages, a
  large session-controller / terminal / attachment pass, and `tool-cordis`
  rewritten from the dynamic define/run/stop tools to read-only inspection)
  keeps session format v3 (`SESSION_FORMAT_VERSION` is still `3`) and leaves the
  plugin-facing seams this bundle relies on unchanged: `agent/pre-step` keeps the
  same payload and an unchanged `PreStepDecision`
  (`core/agent/src/runtime-types.ts`), and `ctx.skills`/provider registration,
  `systemPrompt.context`, `createUserMessage`, `Session.snapshotEvents()` and
  `ctx.get('cordisInspect')` register the same way. `known-event-types.ts` gains
  one additive `workspace/changes` event type, and the rewritten `tool-cordis`
  drops `dynamicCordisRunner` from its own injections — this bundle registers
  only a read-only inspection provider, so neither affects it. `dsh plugin add`
  still forwards to pnpm with the same `file:`/name specs and `--dump-config`
  still prints the composed tree; the only launcher change is that `dsh <name>`
  now abbreviates `dsh --profile <name>` for every profile rather than just
  `web`, so the documented commands keep working. Verified with the
  disposable-profile matrix plus the v3 session-log gate evidence (0.8.11 keeps
  0.1.0-rc.7 … 0.1.6-alpha.2 working).
- DSH 0.1.7-alpha.1 (910 non-merge commits over alpha.2; session format
  **v4**) is the first release that breaks this bundle, and 0.8.12 carries the
  fix. V4 retires the shared `{ kind: 'plugin', plugin }` message-source
  wrapper: native source admission refuses it in every declared durable message
  slot, so the gate append failed with `format v4 message requires a
  producer-owned source kind` and the headless boot aborted. This bundle now
  declares its own kind through `MessageSourceMap` and writes
  `{ kind: 'plugin:embedded-workbench' }` — the exact identity the official
  V3→V4 migration derives for this producer — while the history guard still
  accepts the pre-v4 wrapper, so sessions written by older builds keep their
  once-per-session gate. `agent/pre-step`, `PreStepDecision`,
  `ctx.skills`/provider registration, `systemPrompt.context`,
  `Session.snapshotEvents()` and `ctx.get('cordisInspect')` are otherwise
  unchanged; `known-event-types.ts` only adds `developer/message`, and
  `ContextFormed` still allows an undeclared form. Verified with the
  disposable-profile matrix against 0.1.7-alpha.1 plus regression passes on
  0.1.6-alpha.2 and 0.1.5-rc.2, and by type-checking the sources against the
  0.1.7-alpha.1 declarations (0.8.12 keeps 0.1.0-rc.7 … 0.1.7-alpha.1 working).
- DSH 0.1.5-rc.3 is a three-commit release-pin fix over 0.1.5-rc.2
  (`release(dsh): 0.1.5-rc.3`, `fix(release): pin vendor dependencies for dsh
  0.1.5`) with no source change on any plugin-facing seam. It is the release the
  npm `latest` dist-tag points at, so it is what a plain `npm install -g
  @deepseek-ai/dsh` resolves to; it is now declared and verified rather than left
  implicit in the `^0.1.5-rc.2` branch. Verified with the disposable-profile
  matrix plus the v3 session-log seam evidence (0.8.13 keeps 0.1.0-rc.7 …
  0.1.5-rc.3 working).
- DSH 0.1.7-alpha.2 (162 non-merge commits over alpha.1), 0.1.7-rc.1 (156 over
  alpha.2) and 0.1.7-rc.2 (346 over rc.1; five new packages — `client/shortcuts`,
  `client/ui-shortcuts`, `llm/llm-deepseek-account`, `llm/llm-deepseek-api-key`,
  `util/code-language`) are a client/Web/schedule stabilization line and do not
  break this bundle. The work is dominated by `client/ui-*` (chat, tool,
  conversation, sidebar, workspace, theme, schedule), with
  `boot/plugin-manager`, `boot/app-boot`, `schedule/schedule`,
  `spill/spill-policy`, `subprocess/subprocess-local` and `llm/llm-deepseek`
  behind it. Session format is still **v4** (`SESSION_FORMAT_VERSION` is `4` in
  `packages/core/session/src/types.ts`) and the seams this bundle relies on are
  unchanged or additively widened:
  - `core/agent/src/runtime-types.ts` — which declares both the `agent/pre-step`
    payload (`{ agent, messages, turn, step, signal }`) and `PreStepDecision` —
    is byte-identical between 0.1.7-alpha.1 and 0.1.7-rc.2.
  - `llm/llm/src/message.ts` (`createUserMessage`, `MessageSourceMap`,
    `ContextFormed`) and `session-format-v3-to-v4/src/message-sources.ts` are
    unchanged, so declaring `plugin:embedded-workbench` through
    `MessageSourceMap` and writing `{ kind: 'plugin:embedded-workbench' }` still
    passes native source admission (the rule is unchanged: any non-empty
    producer-owned `kind` other than the retired `'plugin'`).
  - `skill/skill-filesystem`, `core/system-prompt` and
    `extensions/cordis-host-runner` contain no source change, and `skill/skill`'s
    `registerProvider(control => provider)` signature is unchanged, so the eight
    bundled skills still register through the standard filesystem provider and
    reach the session catalog.
  - `Session.toolHistory()` is new and additive; `snapshotEvents()` / `eventAt()`
    keep working, so the version-adaptive `readSessionEvents` history guard is
    unaffected.
  - `projectToolUpdates` — the rc.1/rc.2 tool-add/remove projection that can
    rewrite request history — filters only `role === 'developer'` messages; the
    injected gate is a `user/message` and is passed through verbatim.
  - `ctx.get('cordisInspect')` and `HostCordisInspectProviderRegistration` are
    unchanged, and the rewritten tool-update machinery does not touch the
    read-only inspection provider this bundle registers.
- DSH 0.1.7-rc.1 introduces a **plugin-compatibility preflight** that this bundle
  must pass, and 0.8.13 records the evidence for it. `boot/app-boot` gains
  `plugin-compatibility.ts`, `profile-compatibility.ts` and
  `compatibility-preflight.ts`, and `apps/cli/src/plugin.ts` gains `dsh plugin
  allow-version | revoke-version | version-exemptions` backed by a profile-local
  `compatibility.json`. There are two enforcement points: `dsh plugin add`
  evaluates the named package before installing, and profile composition
  evaluates every selected bundle row before mounting it (an incompatible row is
  disabled with `disabling profile plugin …`; a refused install reports `crashes
  or data loss` / `nothing was installed`). Both call
  `evaluatePluginCompatibility`, which checks each `peerDependencies` entry named
  `@deepseek-ai/dsh` or `@deepseek-ai/dsh-*` with `semver.satisfies(runtime,
  range, { includePrerelease: true })` and otherwise requires an exact
  `package@version` + DSH-version exemption. This bundle declares `^0.1.0-rc.6`
  (and `^0.1.0-rc.8` for `dsh-skill-filesystem`), which under
  `includePrerelease: true` admits every 0.1.x, so no exemption is needed. The
  check reads `peerDependencies`, **not** `dsh.compatibility`. Verified
  empirically rather than by inspection alone: every row's install and boot was
  asserted free of the refusal wording, and the published
  `dsh-app-boot@0.1.7-rc.2` bundle was confirmed to ship the same
  `includePrerelease: true` call. The matrix for this round ran 2 plugins × 6
  runtimes (0.1.5-rc.3, 0.1.6-alpha.2 and 0.1.7-alpha.1 as regression controls,
  plus 0.1.7-alpha.2, 0.1.7-rc.1 and 0.1.7-rc.2) and passed 12/12; both bundles
  were also type-checked with `tsc --noEmit` against the 0.1.5-rc.3,
  0.1.7-alpha.2, 0.1.7-rc.1 and 0.1.7-rc.2 declarations (0.8.13 keeps
  0.1.0-rc.7 … 0.1.7-rc.2 working).
- **Known limitation, accepted: the preflight cannot protect this package.**
  Because the peer ranges above (`^0.1.0-rc.6`, and `^0.1.0-rc.8` for
  `@deepseek-ai/dsh-skill-filesystem`) admit every 0.1.x under
  `includePrerelease: true`, `evaluatePluginCompatibility` never returns an
  issue for this bundle — including on a future 0.1.x release that has not been
  verified here. The preflight added in 0.1.7-rc.1 is therefore a no-op for this
  package, and `dsh.compatibility.dshReleases` (hand-maintained, one row per
  release actually exercised) remains the authoritative compatibility
  statement. This is deliberate: narrowing the peers to explicit `||` branches
  would let a DSH patch release disable the plugin on every profile before this
  repo re-verifies, which is worse for users than the status quo. A future round
  that narrows the ranges should also confirm that
  `dsh plugin allow-version <pkg>@<version> --dsh-version <exact> --accept-risk`
  is documented for the users it would newly block.
- 0.8.2 is deprecated on npm with a warning pointing to 0.8.3 (npmjs blocks
  `npm unpublish` for automation tokens under its 2FA write policy): its
  `dsh.compatibility.dsh` range (`^0.1.2-alpha.3`) admitted 0.1.2-alpha.4
  while that bundle predated the alpha.4 session API fix. 0.8.4 continues the
  same session-adapter lineage and is published as `latest`.
- Windows-only evidence; other platforms were not exercised.
