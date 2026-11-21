// What one operation is, in this file:
//   css package   one `css(style)` of an instance of this package (`createInstance`), which flattens its
//                 arguments and hands them to its cache.
//   core engine   one `engine.css(style)` of an engine of the core, which is its cache's `css`.
//   hit           a small style the cache already holds: the same object each time. The cache is keyed
//                 by the compiled rules, so a hit still compiles and hashes the style.
//   miss          a small style the cache has not seen: the pool of 2000 distinct styles walked in order,
//                 with a fresh instance (or engine) each time the pool comes round, which is part of the
//                 figure, a very small part.
// Both sides write unlayered rules (`hasLayers: false`, the default of this package) into an in-memory
// sheet, so the difference is this package's own work. The built `dist` is loaded after
// `prepareBuiltPackages`, which sends the `@umber-style/core` that it requires to the built core.
import type { BenchConfig } from '@soroush.tech/bench'
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import { prepareBuiltPackages } from '../../../bench/src/built'
import { createCycle, createDistinctStyles, createSmallStyle } from '../../../bench/src/styles'
import type createInstanceSource from '../src/createInstance'

prepareBuiltPackages()
const load = createRequire(import.meta.url)
const core = load('../../core/dist/index.cjs') as typeof Core
const { default: createInstance } = load('../dist/create-instance.cjs') as {
  default: typeof createInstanceSource
}

const createPlain = () => createInstance({ key: 'b', sheet: core.createMemorySheet() })
const createEngine = () =>
  core.createEngine(
    {},
    { cache: core.createCache({ prefix: 'b', hasLayers: false, sheet: core.createMemorySheet() }) }
  )

const small = createSmallStyle()
const plainHit = createPlain()
plainHit.css(small)
const engineHit = createEngine()
engineHit.css(small)

let plainMiss = createPlain()
const nextPlainMiss = createCycle(createDistinctStyles(2000), () => {
  plainMiss = createPlain()
})
let engineMiss = createEngine()
const nextEngineMiss = createCycle(createDistinctStyles(2000), () => {
  engineMiss = createEngine()
})

export default {
  name: 'css: class names',
  cases: {
    'css package: hit, the same small style': () => plainHit.css(small),
    'core engine: hit, the same small style': () => engineHit.css(small),
    'css package: miss, a new small style': () => plainMiss.css(nextPlainMiss()),
    'core engine: miss, a new small style': () => engineMiss.css(nextEngineMiss()),
  },
} satisfies BenchConfig
