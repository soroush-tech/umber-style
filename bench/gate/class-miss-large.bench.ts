// One operation: `cache.css(style)` of a large style (more than 50 declarations, pseudo selectors, media
// and supports queries) that the cache has not seen: `zIndex` differs each time, and the cache is made
// again every 500 operations. Same work as core/classes.bench.ts.
import type { BenchConfig } from '@soroush.tech/bench'
import * as local from '../../packages/core/dist/index.cjs'
import { createLargeStyle } from '../src/styles'
import { previousCore } from './baseline'
import { createSides } from './support'

export default {
  name: 'core: a new large style',
  packages: { previous: previousCore },
  cases: createSides(local, (core) => {
    const fresh = () => core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })
    let cache = fresh()
    let count = 0
    return () => {
      if (count % 500 === 0) cache = fresh()
      const style = { ...createLargeStyle(), zIndex: count }
      count += 1
      return cache.css(style)
    }
  }),
} satisfies BenchConfig
