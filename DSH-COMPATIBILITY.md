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
| Test date | 2026-08-27 |
| Package under test | `dsh-embedded-workbench` 0.8.0 (bundle patch `cordis.patch.yml`, entry id `embedded-workbench`) |

## Method (one disposable profile per version)

Each DSH release was installed into its own runtime directory and tested with a
fresh `DSH_HOME` so no state leaked between versions:

```bash
# 1) install: fresh profile, plugin added as a file: dependency
dsh plugin --profile ew add "file:<this-repo>"            # pnpm add succeeds

# 2) mount check: composed tree contains the plugin row, enabled
dsh --profile ew --dump-config                             # id: embedded-workbench / enabled: true

# 3) start: headless boot with a deliberately invalid API key.
#    Expected: tree mounts and the app reaches the model-provider stage,
#    failing only with AUTH for the fake key; no plugin load errors.
DEEPSEEK_API_KEY=fake-key-for-boot-test dsh --profile headless "reply OK"

# 4) uninstall: plugin removed, row gone from the composed tree
dsh plugin --profile ew remove dsh-embedded-workbench
dsh --profile ew --dump-config                             # no embedded-workbench row
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

## Declared compatibility (package.json)

```json
"engines": { "node": ">=20" },
"dsh": {
  "engines": { "dsh": ">=0.1.0-rc.7" },
  "compatibility": {
    "dsh": "^0.1.0-rc.7 || ^0.1.1-rc.1",
    "dshReleases": {
      "0.1.0-rc.7": "compatible",
      "0.1.0-rc.8": "compatible",
      "0.1.1-rc.1": "compatible",
      "0.1.1-rc.2": "compatible"
    },
    "profiles": ["headless"]
  }
}
```

## Notes

- Peer ranges for `@deepseek-ai/dsh-llm` / `@deepseek-ai/dsh-session` were
  corrected from stale `^0.0.1-rc.1` to `^0.1.0-rc.6` (matching the tested
  runtime closures) in this release.
- Windows-only evidence; other platforms were not exercised.
