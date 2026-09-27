// Offline verification of the gate injection: the invariant is that the gate
// enters a session exactly once, and that it is re-injected when the session's
// first step never committed it (an inbox cleared by a blank-session preset
// switch, or an anchored/bootstrap preset that strips first-step reminders).
//
// This test drives the real `apply()` from the committed lib/ output against a
// stub context, so it depends on nothing but this repository — no dsh profile,
// no network, no sibling checkout. That is what lets CI run it.
//
// Run from the embedded-workbench dev directory:
//   node tests/dsh-gate-injection.test.mjs
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

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
  apply(ctx, { enabled: true, gateContent: GATE })
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
  apply(ctx, { enabled: true, gateContent: GATE })
  const decision = await runPreStep(listeners, sourcedEvent('user/message', { kind: GATE_KIND }))
  check('a v4 history row suppresses re-injection', () => {
    assert.equal(decision.messages.length, 1)
    assert.ok(!carriesGate(decision))
  })
}

{
  const { ctx, listeners } = makeApp()
  apply(ctx, { enabled: true, gateContent: GATE })
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
  apply(ctx, { enabled: true, gateContent: GATE })
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
  apply(ctx, { enabled: true, gateContent: GATE })
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
  apply(ctx, { enabled: true, gateContent: GATE })
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
  apply(ctx, { enabled: true, gateContent: GATE })
  const decision = await runPreStep(listeners, undefined)
  check('a session without an event accessor neither throws nor skips the gate', () => {
    assert.ok(carriesGate(decision))
  })
}

// -- config and decision pass-through --------------------------------------
{
  const { ctx, listeners, skillProviderCount } = makeApp()
  apply(ctx, { enabled: false, gateContent: GATE })
  check('enabled: false registers no pre-step listener', () => {
    assert.equal(listeners['agent/pre-step'], undefined)
  })
  check('enabled: false still registers the skills provider', () => {
    // The gate is optional; the catalog is not.
    assert.equal(skillProviderCount(), 1)
  })
}

{
  const { ctx, listeners } = makeApp()
  apply(ctx, { enabled: true, gateContent: GATE })
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
