# Release Checklist — Embedded Workbench

Shipping checklist for this plugin across the DeepSeek Harness (dsh) ecosystem and the other marketplaces. Run the items top to bottom; the dsh bundle is the only piece that ships code (the repository root package), everything else is manifests, skills, and docs.

## Version policy

Strict semver (`X.Y.Z`); the current pre-1.0 line is `0.Y.Z`:

- **Patch** (`0.5.2 → 0.5.3`): bug fixes, docs, dependency bumps, CI/tooling changes. The default for routine updates.
- **Minor** (`0.5.3 → 0.6.0`): new features, new checks/tools, or backward-compatible behavior changes.
- **Major** (`0.6.0 → 1.0.0`): breaking changes (or the first stable 1.0 release).

Don't bump the version just because something changed — routine dependency/docs/CI
updates are patches; when in doubt, patch. Every release bumps with an explicit
target version (`node scripts/bump-version.mjs <new-version>`), so the choice is
deliberate instead of habitual.

## 0. Pre-flight (local)

- [ ] Working tree clean; current branch is `master`
- [ ] Version bumped with the release tool — `node scripts/bump-version.mjs <new-version>` —
  which updates every declared manifest in `.version-bump.json` (`package.json`,
  `package-lock.json` ×2, all plugin manifests, `.version-bump.json` itself) plus
  the `DSH-COMPATIBILITY.md` "Package under test" row, then audits for missed files
- [ ] `node scripts/bump-version.mjs --check` confirms all declared files are in sync
- [ ] `npx markdownlint-cli --ignore "**/node_modules/**" .` passes with the repo's `.markdownlint.json`
- [ ] Bundle checks (rc-era dsh packages have peer conflicts — `--legacy-peer-deps` is required):

  ```bash
  npm ci --legacy-peer-deps
  npm run typecheck
  npm run build
  git diff --exit-code -- lib   # lib/ must be committed and current
  ```

- [ ] Bundle mounts locally:

  ```bash
  dsh plugin --profile scratch add "file:$PWD"
  dsh --profile scratch --dump-config    # expect: id: embedded-workbench / enabled: true
  rm -rf ~/.dsh/profiles/scratch
  ```

- [ ] Claude-side manifests still validate (`claude plugin validate`) when they changed

## 1. Push to GitHub

- [ ] `git push embedded-workbench master`
- [ ] CI (`dsh-bundle` workflow) green: typecheck, build, committed-lib drift guard, markdownlint
- [ ] Remote install works (skills layer + bundle row):

  ```bash
  dsh plugin --profile scratch add "github:AmethystLuna/embedded-workbench"
  dsh --profile scratch --dump-config   # row present
  ```

## 2. npm publish (optional — enables bare-package installs)

- [ ] `npm login`
- [ ] `npm publish` from the repository root (publish whitelist: `lib/`, `src/`, `skills/`, `cordis.patch.yml`; the root package is the dsh bundle)
- [ ] Verify: `dsh plugin --profile scratch add dsh-embedded-workbench` → `--dump-config` shows the row
- [ ] Developer preview policy: prefer publishing a fixed version over `npm unpublish`/`npm deprecate` for broken releases

## 3. Real-profile trial (end-to-end, requires restarting the target profile)

- [ ] `dsh plugin --profile web add "github:AmethystLuna/embedded-workbench"` (or `dsh plugin --profile web add dsh-embedded-workbench`)
- [ ] Restart the web profile
- [ ] Confirm all three:
  - `dsh --profile web --dump-config` contains the `embedded-workbench` row
  - the session-start gate text (1% Rule / Red Flags / Plan Verification Gate) appears in the model context of the **first step** of a new session
  - `cordis_inspect_list` shows the `embedded-workbench` provider; `cordis_inspect_query` `status` returns `enabled: true`
- [ ] Optional: override `gateContent` (and `enabled`) in the profile's `cordis.patch.yml` by row id

## 4. Housekeeping

- [ ] Tag the release (`git tag vX.Y.Z && git push --tags`)
- [ ] Keep `.dsh/INSTALL.md` install options in sync with what is actually published
- [ ] Keep the "Version pinning" note in `.dsh/INSTALL.md` in sync with the dsh release actually verified
- [ ] Decide the next version per the Version policy; bump it at the start of the next cycle with `node scripts/bump-version.mjs <new-version>`
