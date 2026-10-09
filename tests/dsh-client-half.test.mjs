/**
 * Contract test for this package's browser half (`lib/client.js`).
 *
 * The bundle is hand-authored rather than emitted by `tsc`, so nothing else in
 * CI would notice a wrong module id, a dropped cordis `inject`, or a switch
 * that writes the wrong settings path. This test loads the built artifact the
 * way the dsh Web client does — through a `window.__ModuleLoader__` stub — and
 * drives the registered component with fake React primitives, a fake settings
 * form, and a fake slot registry.
 *
 * Self-contained: no React, no browser, no cordis. Run with `node`.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

let failures = 0
async function check(name, fn) {
  try {
    await fn()
    console.log('  ok  ' + name)
  } catch (error) {
    failures += 1
    console.error('  FAIL ' + name + '\n       ' + (error && error.message))
  }
}

// --- module-system stub ------------------------------------------------------

const loaded = []
globalThis.window = { __ModuleLoader__: { load: (registration) => loaded.push(registration) } }

// --- fake React primitives ---------------------------------------------------

function createElement(type, props, ...children) {
  const merged = { ...(props ?? {}) }
  if (children.length === 1) merged.children = children[0]
  else if (children.length > 1) merged.children = children
  return { type, props: merged }
}

const React = {
  createElement,
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
}


const requireShim = (specifier) => {
  if (specifier === 'react') return React
  if (specifier.startsWith('@deepseek-ai/')) {
    throw new Error('the client half must not require a Harness Client package: ' + specifier)
  }
  throw new Error('unexpected module request: ' + specifier)
}

/** Depth-first search over an element tree built by the stub above. */
function find(node, predicate) {
  if (node === null || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, predicate)
      if (hit !== undefined) return hit
    }
    return undefined
  }
  if (predicate(node)) return node
  return node.props === undefined ? undefined : find(node.props.children, predicate)
}

/** The vendored controls are identified by their displayName contract. */
const findSwitch = (tree) => find(tree, (node) => node.type !== undefined && node.type !== null && node.type.displayName === 'dsh-embedded-workbench:Switch')
const findButton = (tree) => find(tree, (node) => node.type !== undefined && node.type !== null && node.type.displayName === 'dsh-embedded-workbench:Button')

// --- the artifact ------------------------------------------------------------

await import('../lib/client.js')

await check('the bundle registers exactly one factory under the package name', () => {
  if (loaded.length !== 1) throw new Error('expected 1 registration, got ' + loaded.length)
  if (loaded[0].id !== pkg.name) {
    throw new Error('module id "' + loaded[0].id + '" is not the package name "' + pkg.name + '"')
  }
  if (typeof loaded[0].factory !== 'function') throw new Error('factory is not a function')
})

await check('package.json declares a web client half that resolves to the built file', () => {
  if (pkg.dsh?.client?.platform !== 'web') throw new Error('dsh.client.platform must be "web"')
  const entry = pkg.exports?.['./client']
  const rel = typeof entry === 'string' ? entry : entry?.default
  if (typeof rel !== 'string') throw new Error('exports["./client"] must name the bundle')
  if (!existsSync(join(root, rel))) throw new Error(rel + ' does not exist; run npm run build')
})

const face = loaded[0].factory(requireShim)

await check('the factory returns the cordis plugin face', () => {
  if (typeof face.apply !== 'function') throw new Error('apply is missing')
  const expected = ['slots', 'locale', 'configForms']
  const actual = face.inject
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('inject is ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected))
  }
})

// --- mount against fake cordis services --------------------------------------

const disposers = []
let dictionary
let registered
let formCalls = []
let snapshot = {
  status: 'ready',
  value: { enabled: true },
  base: undefined,
  user: undefined,
  revision: 1,
  writable: true,
  mode: 'host',
}

const form = {
  getSnapshot: () => snapshot,
  subscribe: () => () => {},
  set: (field, value) => {
    formCalls.push(['set', field, value])
    return Promise.resolve(true)
  },
  unset: (field) => {
    formCalls.push(['unset', field])
    return Promise.resolve(true)
  },
}

const ctx = {
  effect: (fn, label) => {
    const disposer = fn()
    disposers.push([label, disposer])
    return () => {}
  },
  locale: {
    register: (ns, dicts) => {
      dictionary = { ns, dicts }
      return () => {}
    },
  },
  configForms: {
    get: (ns) => {
      if (ns !== 'embedded-workbench') throw new Error('unexpected namespace: ' + ns)
      return form
    },
    whileServed: (namespaces, register) => {
      if (namespaces.length !== 1 || namespaces[0] !== 'embedded-workbench') {
        throw new Error('unexpected namespaces: ' + JSON.stringify(namespaces))
      }
      return register(new Set(namespaces))
    },
  },
  slots: {
    inject: (name, cb) => {
      if (name !== 'plugins.bundle.config') throw new Error('unexpected slot: ' + name)
      return cb()
    },
    register: (options, component) => {
      registered = { options, component }
      return () => {}
    },
  },
}

face.apply(ctx)

await check('registers the switch on the Plugins page as this bundle\'s configuration', () => {
  if (registered === undefined) throw new Error('nothing was registered')
  if (registered.options.name !== 'plugins.bundle.config') {
    throw new Error('slot is ' + registered.options.name)
  }
  if (registered.options.key !== pkg.name) {
    throw new Error('key is "' + registered.options.key + '", expected the package name')
  }
  if (typeof registered.options.locale !== 'string') throw new Error('no locale namespace declared')
  if (typeof registered.component !== 'function') throw new Error('no component')
})

await check('registers bilingual dictionaries under a namespace nobody else owns', () => {
  if (dictionary === undefined) throw new Error('no dictionary registered')
  if (dictionary.ns !== registered.options.locale) {
    throw new Error('dictionary namespace ' + dictionary.ns + ' != entry locale ' + registered.options.locale)
  }
  const langs = Object.keys(dictionary.dicts).sort()
  if (langs.join(',') !== 'en,zh') throw new Error('dictionaries are ' + langs.join(','))
  const en = Object.keys(dictionary.dicts.en).sort()
  const zh = Object.keys(dictionary.dicts.zh).sort()
  if (en.join(',') !== zh.join(',')) throw new Error('zh/en key sets differ')
})

await check('every effect is labelled, so a teardown names what it released', () => {
  for (const [label] of disposers) {
    if (typeof label !== 'string' || label.length === 0) throw new Error('an effect has no label')
  }
})

const face2 = registered.options.inject()

await check('the injected face exposes the form hook and both write actions', () => {
  if (typeof face2.hooks?.injectionForm?.getSnapshot !== 'function') throw new Error('no form snapshot source')
  if (typeof face2.hooks.injectionForm.subscribe !== 'function') throw new Error('no form subscription')
  if (typeof face2.setEnabled !== 'function') throw new Error('setEnabled is missing')
  if (typeof face2.resetEnabled !== 'function') throw new Error('resetEnabled is missing')
})

/** Render the card with the injected face bound as the page binds it. */
function render(t = (key) => key) {
  return registered.component({
    t,
    useInjectionForm: (selector) => selector(snapshot),
    setEnabled: face2.setEnabled,
    resetEnabled: face2.resetEnabled,
  })
}

await check('renders the switch on when the field is unset (schema default true)', () => {
  const toggle = findSwitch(render())
  if (toggle === undefined) throw new Error('no switch rendered')
  if (toggle.props.checked !== true) throw new Error('switch is not on')
})

await check('renders the switch off when the stored field is false', () => {
  snapshot = { ...snapshot, value: { enabled: false } }
  const toggle = findSwitch(render())
  if (toggle.props.checked !== false) throw new Error('switch is not off')
})

await check('a toggle writes the volatile field through the settings form', async () => {
  formCalls = []
  snapshot = { ...snapshot, value: { enabled: true } }
  const toggle = findSwitch(render())
  toggle.props.onChange(false)
  await new Promise((resolve) => setTimeout(resolve, 0))
  if (JSON.stringify(formCalls) !== JSON.stringify([['set', 'enabled', false]])) {
    throw new Error('writes were ' + JSON.stringify(formCalls))
  }
})

await check('offers a reset only while the user layer carries the field', () => {
  snapshot = { ...snapshot, value: { enabled: false }, user: { enabled: false } }
  const reset = findButton(render())
  if (reset === undefined) throw new Error('no reset control for an overridden field')
  snapshot = { ...snapshot, user: undefined }
  const absent = findButton(render())
  if (absent !== undefined) throw new Error('a reset control rendered without an override')
})

await check('a reset clears the field so it re-inherits the default', async () => {
  formCalls = []
  snapshot = { ...snapshot, value: { enabled: false }, user: { enabled: false } }
  const reset = findButton(render())
  reset.props.onClick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  if (JSON.stringify(formCalls) !== JSON.stringify([['unset', 'enabled']])) {
    throw new Error('writes were ' + JSON.stringify(formCalls))
  }
})

await check('locks the switch while the deployment stores settings read-only', () => {
  snapshot = { ...snapshot, writable: false }
  const toggle = findSwitch(render())
  if (toggle.props.disabled !== true) throw new Error('the switch is not disabled on a read-only deployment')
})

await check('says why it cannot render while the namespace is not served', () => {
  snapshot = { status: 'unavailable', value: undefined, writable: false }
  const tree = render()
  if (findSwitch(tree) !== undefined) {
    throw new Error('a switch rendered for an unserved namespace')
  }
  if (find(tree, (node) => node.props?.children === 'unavailable') === undefined) {
    throw new Error('no unavailable note rendered')
  }
})

await check('a host whose settings service has no whileServed() degrades instead of throwing', () => {
  // Measured on dsh 0.1.5-rc.3 and 0.1.6-alpha.2: their settings service has no
  // `whileServed`, so calling it would throw inside this plugin's own activation
  // and the Web boot audit would report a failed client entry.
  let touched = 0
  const bare = {
    effect: (fn) => { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    locale: { register: () => () => {} },
    configForms: { get: () => { touched += 1; return form } },
    slots: {
      inject: () => { touched += 1; return () => {} },
      register: () => { touched += 1; return () => {} },
    },
  }
  face.apply(bare)
  if (touched !== 0) throw new Error('nothing may be registered without whileServed (reached ' + touched + ')')
})

if (failures > 0) {
  console.error('\nFAIL client half: ' + failures + ' check(s) failed')
  process.exit(1)
}
console.log('\nPASS client half: module id, slot registration, dictionaries, and the injection switch')
