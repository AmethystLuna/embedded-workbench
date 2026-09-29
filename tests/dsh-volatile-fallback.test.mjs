/**
 * Guard test for the schemastery degradation path.
 *
 * `Config.enabled` is declared `.volatile()` so the Web Plugins page can edit the
 * injection switch live. `.volatile()` only exists from schemastery 3.18.3, and
 * `Config` is built while `lib/index.js` is being evaluated — so on a host
 * shipping 3.18.2 (measured: dsh 0.1.5-rc.2 and 0.1.5-rc.3) an unconditional
 * call throws during import, the loader entry fails, and the whole plugin tree
 * takes the host's boot down with it.
 *
 * This test reproduces that host faithfully without a second schemastery
 * install: it removes `.volatile` from the real prototype *before* importing the
 * artifact, so the module is evaluated exactly as it would be on 3.18.2. Without
 * it the fallback branch would only ever run on a user's machine.
 *
 * Self-contained; run with `node`.
 */

import assert from 'node:assert/strict'
import z from '@deepseek-ai/schemastery'

const GATE = 'GATE-TEXT-SENTINEL'

const proto = Object.getPrototypeOf(z.boolean())
const saved = proto.volatile
if (typeof saved !== 'function') {
  console.error('FAIL  precondition: this schemastery exposes no .volatile() to remove, so the fallback cannot be exercised')
  process.exit(1)
}

// Stand in for schemastery 3.18.2. The module decides this once, at evaluation.
delete proto.volatile

let mod
try {
  mod = await import('../lib/index.js')
} catch (err) {
  proto.volatile = saved
  console.error('FAIL  lib/index.js threw while being evaluated without .volatile():')
  console.error('        ' + (err && err.message))
  console.error('      This is the dsh 0.1.5-rc.2 / 0.1.5-rc.3 boot failure: the loader entry dies and the host cannot start.')
  process.exit(1)
}
// `Config` is built now, so the degraded shape is fixed; nothing below re-probes.
proto.volatile = saved

/** Minimal cordis context: records the pre-step listener and captures the inspect provider. */
function makeApp() {
  const listeners = {}
  let skillProviders = 0
  let inspect
  const ctx = {
    skills: { registerProvider: () => { skillProviders += 1; return () => {} } },
    get: (name) =>
      name === 'cordisInspect'
        ? { register: (provider) => { inspect = provider; return () => {} } }
        : undefined,
    // `effect` runs its callback (and keeps what it returns as the disposer),
    // exactly as cordis does — the plugin registers its collaborateurs inside one.
    effect: (fn) => { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    on: (event, handler) => { listeners[event] = handler },
  }
  return { ctx, listeners, inspect: () => inspect, skillProviderCount: () => skillProviders }
}

/** Build the config through the real schema, as the Loader builds it. */
const makeConfig = (enabled) => new mod.Config({ enabled, gateContent: GATE })

/** Run the registered pre-step listener over a session with no durable history. */
async function runPreStep(listeners) {
  const base = { kind: 'enter', messages: [{ id: 'base' }] }
  return listeners['agent/pre-step']({ agent: { session: { events: [] } } }, async () => base)
}

const results = []
async function check(label, fn) {
  try {
    await fn()
    results.push('PASS  ' + label)
  } catch (err) {
    results.push('FAIL  ' + label + '\n        ' + (err && err.message))
  }
}

await check('the module evaluates without .volatile(), so the host still boots', () => {
  assert.equal(typeof mod.apply, 'function')
  assert.ok(Array.isArray(mod.inject), 'the plugin face must survive too')
})

await check('the switch degrades to a plain boolean, not a reference', () => {
  assert.equal(typeof makeConfig(true).enabled, 'boolean', 'expected a plain boolean')
  assert.equal(makeConfig(false).enabled, false)
  assert.equal(makeConfig(true).enabled, true)
})

await check('apply() runs and reads the plain switch through the guard', async () => {
  const on = makeApp()
  mod.apply(on.ctx, makeConfig(true))
  assert.equal((await on.inspect().query('status')).enabled, true)
  assert.equal(on.skillProviderCount(), 1, 'the skills provider must still register')

  const off = makeApp()
  mod.apply(off.ctx, makeConfig(false))
  assert.equal((await off.inspect().query('status')).enabled, false)
})

await check('the gate still enters a session on a host without .volatile()', async () => {
  const app = makeApp()
  mod.apply(app.ctx, makeConfig(true))
  const decision = await runPreStep(app.listeners)
  assert.equal(decision.kind, 'enter')
  assert.equal(decision.messages.length, 2, 'expected the base message plus the gate')
  assert.ok(JSON.stringify(decision.messages).includes(GATE), 'the gate text is missing')
})

await check('the gate stays out while the plain switch is off', async () => {
  const app = makeApp()
  mod.apply(app.ctx, makeConfig(false))
  const base = { kind: 'enter', messages: [{ id: 'base' }] }
  const decision = await app.listeners['agent/pre-step']({ agent: { session: { events: [] } } }, async () => base)
  assert.equal(decision, base, 'an off switch must return the decision untouched')
})

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
if (failed > 0) {
  console.error('\nFAIL volatile fallback: ' + failed + ' check(s) failed')
  process.exit(1)
}
console.log('\nPASS volatile fallback: the plugin loads, applies, and still injects without schemastery .volatile()')
