// One operation: `cache.css(style)` of the same small style object again, over a cache that holds it (a
// hit still compiles and hashes the style). Same work as core/classes.bench.ts.
import type { BenchConfig } from '@soroush.tech/bench'
import * as local from '../../packages/core/dist/index.cjs'
import { createSmallStyle } from '../src/styles'
import { previousCore } from './baseline'
import { createSides } from './support'

export default {
  name: 'core: the same style again',
  packages: { previous: previousCore },
  cases: createSides(local, (core) => {
    const cache = core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })
    const style = createSmallStyle()
    cache.css(style)
    return () => cache.css(style)
  }),
} satisfies BenchConfig
