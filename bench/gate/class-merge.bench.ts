// One operation: `cache.css(a, b, c, d, e)`, five classes the cache made, resolved back to their styles,
// merged, compiled and found again. Same work as core/classes.bench.ts.
import type { BenchConfig } from '@soroush.tech/bench'
import * as local from '../../packages/core/dist/index.cjs'
import { previousCore } from './baseline'
import { createSides } from './support'

export default {
  name: 'core: merging five classes',
  packages: { previous: previousCore },
  cases: createSides(local, (core) => {
    const cache = core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })
    const classes = Array.from({ length: 5 }, (_, index) =>
      cache.css({ color: 'red', padding: index + 1, '&:hover': { opacity: index / 10 } })
    )
    cache.css(...classes)
    return () => cache.css(...classes)
  }),
} satisfies BenchConfig
