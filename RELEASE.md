# Release Checklist — Embedded Workbench

Shipping checklist for this plugin across the DeepSeek Harness (dsh) ecosystem and the other marketplaces. Run the items top to bottom; the dsh bundle is the only piece that ships code (`packages/dsh-plugin`), everything else is manifests, skills, and docs.

## 0. Pre-flight (local)

- [ ] Working tree clean; current branch is `master`
- [ ] Version bumped in **every** manifest listed in `.version-bump.json` and kept identical (`.claude-plugin/plugin.json`, marketplace, `.codex-plugin`, `.cursor-plugin`, `.kimi-plugin`, root `package.json`, `packages/dsh-plugin/package.json`)
- [ ] `npx markdownlint-cli --ignore "**/node_modules/**" .` passes with the repo's `.markdownlint.json`
- [ ] Bundle checks (rc-era dsh packages have peer conflicts — `--legacy-peer-deps` is required):

  ```bash
  cd packages/dsh-plugin
  npm ci --legacy-peer-deps
  npm run typecheck
  npm run build
  git diff --exit-code -- lib   # lib/ must be committed and current
  ```

- [ ] Bundle mounts locally:

  ```bash
  dsh plugin --profile scratch add "file:$PWD/packages/dsh-plugin"
  dsh --profile scratch --dump-config    # expect: id: embedded-workbench / enabled: true
  rm -rf ~/.dsh/profiles/scratch
  ```

- [ ] Claude-side manifests still validate (`claude plugin validate`) when they changed

## 1. Push to GitHub

- [ ] `git push origin master`
- [ ] CI (`dsh-bundle` workflow) green: typecheck, build, committed-lib drift guard, markdownlint
- [ ] Remote install works (skills layer + bundle row):

  ```bash
  dsh plugin --profile scratch add "github:AmethystLuna/embedded-workbench"
  dsh --profile scratch --dump-config   # row present
  ```

## 2. npm publish (optional — enables bare-package installs)

- [ ] `npm login`
- [ ] `cd packages/dsh-plugin && npm publish` (publish whitelist: `lib/`, `cordis.patch.yml`)
- [ ] Verify: `dsh plugin --profile scratch add embedded-workbench-dsh` → `--dump-config` shows the row
- [ ] Developer preview policy: prefer publishing a fixed version over `npm unpublish`/`npm deprecate` for broken releases

## 3. Real-profile trial (end-to-end, requires restarting the target profile)

- [ ] `dsh plugin --profile web add "github:AmethystLuna/embedded-workbench"` (or the npm package name)
- [ ] Restart the web profile
- [ ] Confirm all three:
  - `dsh --profile web --dump-config` contains the `embedded-workbench` row
  - the session-start gate text (1% Rule / Red Flags / Plan Verification Gate) appears in the model context of the **first step** of a new session
  - `cordis_inspect_list` shows the `embedded-workbench` provider; `cordis_inspect_query` `status` returns `enabled: true`
- [ ] Optional: override `gateContent` (and `enabled`) in the profile's `cordis.patch.yml` by row id

## 4. Housekeeping

- [ ] Tag the release (`git tag vX.Y.Z && git push --tags`)
- [ ] Keep `.dsh/INSTALL.md` install options in sync with what is actually published
- [ ] Keep `packages/dsh-plugin/README.md` "Version pinning" note in sync with the dsh release actually verified
- [ ] Update `.version-bump.json` `version` field to the next target before starting the next cycle
