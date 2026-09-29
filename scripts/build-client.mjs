#!/usr/bin/env node
/**
 * Publish this package's browser half as `lib/client.js`.
 *
 * The client bundle is hand-authored in the module-system format the dsh Web
 * client loads (`window.__ModuleLoader__.load({ id, factory })`), which `tsc`
 * does not emit: a factory-form bundle needs a synchronous `require`, a single
 * file whose whole body sits inside the factory closure, and an `id` that is
 * the package's resolved npm name. So the build copies the authored source
 * verbatim, and CI's committed-`lib/` drift guard keeps the two in step.
 *
 * @module embedded-workbench/scripts/build-client
 */

import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const from = join(root, 'src', 'client.js')
const to = join(root, 'lib', 'client.js')

mkdirSync(dirname(to), { recursive: true })
copyFileSync(from, to)
console.log('build-client: lib/client.js <- src/client.js')
