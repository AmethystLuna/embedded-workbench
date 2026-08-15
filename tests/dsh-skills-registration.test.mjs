// Offline verification that the dsh bundles register their shipped skills
// into the real SkillRegistry: a bare cordis app mounts the registry service
// and both plugins, then the catalog must contain every shipped skill and
// loading must return a directory resource base.
//
// Run from the embedded-workbench dev directory:
//   node tests/dsh-skills-registration.test.mjs
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import { apply as ewbApply, name as ewbName } from '../lib/index.js'
import { apply as lpApply, name as lpName } from '../../logicprobe/lib/index.js'

const expected = {
  'embedded-workbench': [
    'c-cpp-dev',
    'debug-methodology',
    'embedded-firmware-dev',
    'embedded-workbench',
    'hardfault-triage',
    'keil-mdk-build',
    'state-machine-design',
  ],
  'logicprobe': ['logicprobe'],
}

const app = new Context()
new SkillRegistry(app)
await app.plugin({ name: ewbName, apply: ewbApply }, { enabled: true })
await app.plugin({ name: lpName, apply: lpApply }, { enabled: true })

try {
  const cwd = process.cwd()
  const snapshot = await app.skills.snapshot({ cwd })
  const names = snapshot.skills.map((s) => s.name).sort()
  console.log('catalog:', names.join(', '))
  for (const [plugin, want] of Object.entries(expected)) {
    for (const n of want) {
      if (!names.includes(n)) throw new Error(`${plugin}: missing skill "${n}"`)
    }
  }
  for (const n of Object.values(expected).flat()) {
    const def = await app.skills.get(n, { cwd })
    if (!def) throw new Error(`get("${n}") returned undefined`)
    if (!def.content || def.content.length < 50) throw new Error(`get("${n}") content missing`)
    if (def.resourceBase?.kind !== 'directory') {
      throw new Error(`get("${n}") resourceBase wrong: ${JSON.stringify(def.resourceBase)}`)
    }
    console.log(`get("${n}"): provider=${def.provider} source=${def.source} base=${def.resourceBase.path}`)
  }
  console.log('PASS')
} finally {
  await app.fiber.dispose()
}
