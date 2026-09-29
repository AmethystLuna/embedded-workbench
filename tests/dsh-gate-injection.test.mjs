// Offline verification of the gate injection: the invariant is that the gate
// enters a session exactly once, and that it is re-injected when the session's
// first step never committed it (an inbox cleared by a blank-session preset
// switch, or an anchored/bootstrap preset that strips first-step reminders).
// The switch itself is volatile: it is re-read on every step, so the Web
// Plugins page can turn the injection off and back on inside a running session.
//
// This test drives the real `apply()` from the committed lib/ output against a
// stub context, so it depends on nothing but this repository — no dsh profile,
// no network, no sibling checkout. That is what lets CI run it.
//
// Run from the embedded-workbench dev directory:
//   node tests/dsh-gate-injection.test.mjs
import assert from 'node:assert/strict'
import { createVolatile, updateVolatile } from '@deepseek-ai/cosmokit'
import { apply, Config } from '../lib/index.js'

const GATE = 'GATE-TEXT-SENTINEL'
const GATE_KIND = 'plugin:embedded-workbench'

/** Minimal cordis context: records the listeners and counts registrations. */
function makeApp() {
  const listeners = {}
  let skillProviders = 0
  const ctx = {
    skills: { registerProvider: () => { skillProviders += 1; return () => {} } },
    get: () => undefined,
    effect: () => () => {},
    on: (event, handler) => { listeners[event] = handler },
  }
  return { ctx, listeners, skillProviderCount: () => skillProviders }
}

/**
 * Build the config through the real schema, as the Loader builds it: `enabled`
 * is declared `.volatile()`, so `apply` receives a live reference the Web
 * Plugins page writes into, not a copied boolean.
 */
function makeConfig(overrides) {
  return new Config({ enabled: true, gateContent: GATE, ...overrides })
}

/** One session event with a source, as the durable log records them. */
function sourcedEvent(type, source) {
  return [{ type, data: { source } }]
}

/** Run the registered pre-step listener over a session's durable history. */
async function runPreStep(listeners, events, next) {
  const agent = { session: events === undefined ? {} : { events } }
  const decision = next ?? { kind: 'enter', messages: [{ id: 'base' }] }
  return listeners['agent/pre-step']({ agent }, async () => decision)
}

const carriesGate = (decision) =>
  decision.messages.some((m) => JSON.stringify(m).includes(GATE))

const results = []
function check(label, fn) {
  try {
    fn()
    results.push(`PASS  ${label}`)
  } catch (err) {
    results.push(`FAIL  ${label}\n        ${err.message}`)
  }
}

// -- fresh session: inject once, verbatim ----------------------------------
{
  const { ctx, listeners, skillProviderCount } = makeApp()
  apply(ctx, makeConfig())
  const decision = await runPreStep(listeners, [])
  check('a fresh session appends the gate to the first step', () => {
    assert.equal(decision.kind, 'enter')
    assert.equal(decision.messages.length, 2, 'expected the base message plus the gate')
    assert.equal(decision.messages[0].id, 'base', 'downstream messages must keep their order')
  })
  check('the injected text is the configured gate text, unaltered', () => {
    const gate = decision.messages[1]
    assert.equal(gate.role, 'user')
    assert.equal(gate.content.length, 1)
    assert.equal(gate.content[0].type, 'text')
    assert.equal(gate.content[0].text, GATE)
  })
  check('the gate message carries the producer-owned source kind', () => {
    // The history guard reads exactly this field; if the write path and the
    // guard ever disagree, the gate re-injects on every step.
    assert.equal(decision.messages[1].source.kind, GATE_KIND)
  })
  check('the skill provider is registered exactly once', () => {
    assert.equal(skillProviderCount(), 1)
  })
}

// -- already in history: never inject twice --------------------------------
{
  const { ctx, listeners } = makeApp()
  apply(ctx, makeConfig())
  const decision = await runPreStep(listeners, sourcedEvent('user/message', { kind: GATE_KIND }))
  check('a v4 history row suppresses re-injection', () => {
    assert.equal(decision.messages.length, 1)
    assert.ok(!carriesGate(decision))
  })
}

{
  const { ctx, listeners } = makeApp()
  apply(ctx, makeConfig())
  const decision = await runPreStep(
    listeners,
    sourcedEvent('user/message', { kind: 'plugin', plugin: 'embedded-workbench' }),
  )
  check('a pre-v4 wrapper row suppresses re-injection', () => {
    // DSH 0.1.7-alpha.1 migrated `{ kind: 'plugin', plugin }` to `plugin:<name>`;
    // sessions written before that still carry the wrapper.
    assert.ok(!carriesGate(decision))
  })
}

{
  const { ctx, listeners } = makeApp()
  apply(ctx, makeConfig())
  const decision = await runPreStep(
    listeners,
    sourcedEvent('user/message', { kind: 'plugin', plugin: 'some-other-plugin' }),
  )
  check('another plugin\'s row does not suppress the gate', () => {
    assert.ok(carriesGate(decision))
  })
}

{
  const { ctx, listeners } = makeApp()
  apply(ctx, makeConfig())
  const decision = await runPreStep(
    listeners,
    sourcedEvent('assistant/message', { kind: GATE_KIND }),
  )
  check('the source kind on a non-user event does not suppress the gate', () => {
    assert.ok(carriesGate(decision))
  })
}

// -- read paths and degenerate sessions ------------------------------------
{
  const { ctx, listeners } = makeApp()
  apply(ctx, makeConfig())
  const session = { snapshotEvents: () => sourcedEvent('user/message', { kind: GATE_KIND }) }
  const decision = await listeners['agent/pre-step'](
    { agent: { session } },
    async () => ({ kind: 'enter', messages: [] }),
  )
  check('the snapshotEvents() read path (DSH >= 0.1.2-alpha.4) suppresses re-injection', () => {
    assert.ok(!carriesGate(decision))
  })
}

{
  const { ctx, listeners } = makeApp()
  apply(ctx, makeConfig())
  const decision = await runPreStep(listeners, undefined)
  check('a session without an event accessor neither throws nor skips the gate', () => {
    assert.ok(carriesGate(decision))
  })
}

// -- the injection switch and decision pass-through ------------------------
{
  const { ctx, listeners, skillProviderCount } = makeApp()
  apply(ctx, makeConfig({ enabled: false }))
  check('the pre-step listener is registered even while the switch is off', () => {
    // The switch is volatile and `apply` runs once, so a listener installed
    // only for a true value could never observe a later turn-on from the Web
    // Plugins page without a profile restart.
    assert.equal(typeof listeners['agent/pre-step'], 'function')
  })
  const decision = await runPreStep(listeners, [])
  check('enabled: false injects no gate, but the skills provider is still registered', () => {
    // The gate is optional; the catalog is not.
    assert.equal(decision.messages.length, 1)
    assert.ok(!carriesGate(decision))
    assert.equal(skillProviderCount(), 1)
  })
}

{
  const { ctx, listeners, skillProviderCount } = makeApp()
  const config = makeConfig()
  apply(ctx, config)
  check('enabled is a volatile reference, not a copied boolean', () => {
    // dsh's settings service projects only `.volatile()` fields, so dropping
    // `.volatile()` would leave the Plugins page with nothing to render.
    assert.equal(typeof config.enabled?.get, 'function')
    assert.equal(config.enabled.get(), true)
  })
  updateVolatile(config.enabled, createVolatile(false))
  const off = await runPreStep(listeners, [])
  check('turning the live switch off stops the injection inside the same mount', () => {
    assert.equal(off.messages.length, 1)
    assert.ok(!carriesGate(off))
    assert.equal(skillProviderCount(), 1, 'the skills stay registered while the gate is off')
  })
  updateVolatile(config.enabled, createVolatile(true))
  const on = await runPreStep(listeners, [])
  check('turning it back on injects again, with no profile restart', () => {
    assert.equal(on.messages.length, 2)
    assert.ok(carriesGate(on))
  })
}

{
  const { ctx, listeners } = makeApp()
  apply(ctx, makeConfig())
  const rejected = { kind: 'reject', reason: 'blocked upstream' }
  const decision = await runPreStep(listeners, [], rejected)
  check('a rejected decision passes through untouched', () => {
    assert.deepEqual(decision, rejected)
  })
}

const failed = results.filter((r) => r.startsWith('FAIL'))
console.log(results.join('\n'))
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) process.exit(1)
console.log('PASS')
