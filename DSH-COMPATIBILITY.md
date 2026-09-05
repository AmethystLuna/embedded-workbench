# DSH Compatibility Evidence — Embedded Workbench

Evidence for the DSH STORE fixed-Commit contract (author-remediation notice
[AI-Scarlett/DSH-Store#251](https://github.com/AI-Scarlett/DSH-Store/issues/251)):
per-release install / start / uninstall verification of this plugin's native
dsh bundle against the DSH releases listed in `dsh.compatibility.dshReleases`.

## Environment

| Item | Value |
|---|---|
| Host | Windows 11 (x64), build 19045 |
| Node.js | v22.22.3 |
| npm | 10.9.8 |
| pnpm | 11.21.0 |
| Test date | 2026-09-05 |
| Package under test | `dsh-embedded-workbench` 0.8.5 (bundle patch `cordis.patch.yml`, entry id `embedded-workbench`) |

## Method (one disposable profile per version)

Each DSH release was run from its own runtime (global CLI for
0.1.0-rc.7 … 0.1.2-alpha.3; temporary npm install under an isolated prefix for
0.1.2-alpha.4, 0.1.2-alpha.5, and 0.1.2-rc.1) against a fresh `DSH_HOME`, so
no state leaked between versions. 0.1.3-alpha.1 predates its npm publish, so it
ran from a local pnpm workspace build of git tag `dsh-v0.1.3-alpha.1`; the new
`fs-ext` native dependency (cross-process session write lease) was substituted
with a no-op override for this run because the test host has no MSVC toolchain —
the Windows lease path holds a kernel semaphore and never calls `fs-ext`'s
`flock`.

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

## Declared compatibility (package.json)

```json
"engines": { "node": ">=20" },
"dsh": {
  "engines": { "dsh": ">=0.1.0-rc.7" },
  "compatibility": {
    "dsh": "^0.1.0-rc.7 || ^0.1.1-rc.1 || ^0.1.2-alpha.2 || ^0.1.2-alpha.3 || ^0.1.2-alpha.4 || ^0.1.2-alpha.5 || ^0.1.2-rc.1 || ^0.1.3-alpha.1",
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
      "0.1.3-alpha.1": "compatible"
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
  out on this no-MSVC host (see Method); re-verify against the npm release on a
  toolchain-equipped host once published.
- 0.8.2 is deprecated on npm with a warning pointing to 0.8.3 (npmjs blocks
  `npm unpublish` for automation tokens under its 2FA write policy): its
  `dsh.compatibility.dsh` range (`^0.1.2-alpha.3`) admitted 0.1.2-alpha.4
  while that bundle predated the alpha.4 session API fix. 0.8.4 continues the
  same session-adapter lineage and is published as `latest`.
- Windows-only evidence; other platforms were not exercised.
