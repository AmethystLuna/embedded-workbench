// Offline verification of the Claude Code SessionStart hook: the script must
// emit valid JSON for any content file, and the emitted string must be the file
// verbatim (minus the trailing newline command substitution drops).
//
// This is the regression guard for the escaper. It matters on CI specifically:
// the runner is Ubuntu, whose GNU sed/awk behave differently from the Git Bash
// tools on the author's Windows host — the old sed+awk pipeline produced invalid
// JSON there for a CRLF or tab-containing payload, and only Git for Windows'
// text-mode sed hid that locally.
//
// Run from the embedded-workbench dev directory:
//   node tests/claude-session-start-hook.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOOK = join(REPO, 'hooks', 'session-start')
const HOOKS_JSON = join(REPO, 'hooks', 'hooks.json')
const CONTENT = join(REPO, 'hooks', 'session-start-content.md')

// The hook is a bash script. Without bash there is nothing to test — say so
// rather than reporting a pass that never ran.
if (spawnSync('bash', ['-c', 'exit 0'], { stdio: 'ignore' }).error) {
  console.log('SKIP  bash is not on PATH; the SessionStart hook cannot run here')
  process.exit(0)
}

const work = mkdtempSync(join(tmpdir(), 'ewb-hook-'))
const results = []
let failures = 0

/**
 * Run the hook against `content` in an isolated directory and return its stdout.
 * stdout is redirected by bash itself so no piped stdio is involved.
 */
function runHook(content) {
  const dir = mkdtempSync(join(work, 'case-'))
  copyFileSync(HOOK, join(dir, 'session-start'))
  if (content !== undefined) writeFileSync(join(dir, 'session-start-content.md'), content)
  const out = join(dir, 'stdout.json')
  const err = join(dir, 'stderr.txt')
  const proc = spawnSync(
    'bash',
    ['-c', 'bash "$1" > "$2" 2> "$3"', 'hook', join(dir, 'session-start'), out, err],
    { stdio: 'ignore' },
  )
  return {
    status: proc.status,
    stdout: readFileSync(out, 'utf8'),
    stderr: readFileSync(err, 'utf8'),
  }
}

function check(label, fn) {
  try {
    fn()
    results.push(`PASS  ${label}`)
  } catch (err) {
    failures += 1
    results.push(`FAIL  ${label}\n        ${err.message}`)
  }
}

/** Decode the hook's stdout, asserting the envelope shape along the way. */
function decode(stdout) {
  const parsed = JSON.parse(stdout)
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart')
  return parsed.hookSpecificOutput.additionalContext
}

// -- content that must survive escaping -------------------------------------
const fixtures = {
  lf: 'line1\nline2 with "quotes"\n',
  // Ends with a plain LF on purpose: bash drops trailing newlines, and Git
  // Bash additionally drops the CR that precedes the final LF while GNU bash
  // keeps it, so a trailing CRLF would make the expectation platform-specific.
  // The interior CRLF is what exercises CR escaping.
  crlf: 'line1\r\nline2 with "quotes"\n',
  tab: 'col1\tcol2\n',
  formfeed: 'before\u000cafter\n',
  vertical_tab: 'a\u000bb\n',
  backspace: 'a\u0008b\n',
  escape: 'a\u001bb\n',
  backslash: 'path C:\\foo\\bar and \\\\double\n',
  dollar: 'cost $5 and ${VAR} and $HOME and `tick`\n',
  pipe: 'a | b > c & d\n',
  unicode: 'em—dash 中文 🚀\n',
}

for (const [name, content] of Object.entries(fixtures)) {
  const { status, stdout, stderr } = runHook(content)
  check(`${name}: valid JSON, exit 0, exact payload`, () => {
    assert.equal(status, 0, `exit ${status}; stderr: ${stderr.trim()}`)
    assert.equal(stderr, '', 'the hook must not write to stderr')
    // A raw newline, tab, CR, or other control character inside the JSON string
    // makes JSON.parse throw — which is exactly the failure this guards.
    const ctx = decode(stdout)
    // Command substitution strips the file's trailing newline(s); \r survives.
    assert.equal(ctx, content.replace(/\n+$/, ''))
  })
}

// -- the shipped payload -----------------------------------------------------
{
  const { status, stdout } = runHook(readFileSync(CONTENT))
  check('the shipped payload round-trips exactly', () => {
    assert.equal(status, 0)
    assert.equal(decode(stdout), readFileSync(CONTENT, 'utf8').replace(/\n+$/, ''))
  })
}

// -- degraded path -----------------------------------------------------------
{
  const { status, stdout } = runHook(undefined)
  check('a missing content file still emits valid JSON and exits 0', () => {
    assert.equal(status, 0)
    assert.match(decode(stdout), /content file missing/)
  })
}

// -- hooks.json wiring -------------------------------------------------------
{
  const hooks = JSON.parse(readFileSync(HOOKS_JSON, 'utf8'))
  const handlers = hooks.hooks.SessionStart.flatMap((group) => group.hooks)
  check('hooks.json registers one command handler for the bash hook', () => {
    assert.equal(handlers.length, 1)
    assert.equal(handlers[0].type, 'command')
    assert.match(handlers[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/session-start/)
  })
  check('the hook timeout is a plausible number of seconds', () => {
    // Claude Code reads `timeout` in SECONDS and defaults to 600 for command
    // hooks; a value above that ceiling means it was written in milliseconds.
    const { timeout } = handlers[0]
    assert.ok(Number.isInteger(timeout), `timeout must be an integer, got ${timeout}`)
    assert.ok(timeout > 0 && timeout <= 600, `timeout=${timeout} looks like milliseconds`)
  })
}

rmSync(work, { recursive: true, force: true })
console.log(results.join('\n'))
console.log(`\n${results.length - failures}/${results.length} checks passed`)
if (failures > 0) process.exit(1)
console.log('PASS')
