// One operation: `cache.css(style)` of a small style the cache has not seen (a pool of 2000 is walked,
// and the cache is made again each time the pool comes round). Same work as core/classes.bench.ts.
import type { BenchConfig } from '@soroush.tech/bench'
import * as local from '../../packages/core/dist/index.cjs'
import { createCycle, createDistinctStyles } from '../src/styles'
import { previousCore } from './baseline'
import { createSides } from './support'

export default {
  name: 'core: a new small style',
  packages: { previous: previousCore },
  cases: createSides(local, (core) => {
    const fresh = () => core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })
    let cache = fresh()
    const next = createCycle(createDistinctStyles(2000), () => {
      cache = fresh()
    })
    return () => cache.css(next())
  }),
} satisfies BenchConfig
