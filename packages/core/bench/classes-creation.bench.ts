// What one operation is, in this file:
//   miss      one `cache.css(style)` of a style the cache has not seen: it compiles the rules, names the
//             class, and inserts the rules into an in-memory sheet. The small styles are a pool of 2000
//             walked in order, and the cache is made again each time the pool comes round; the large
//             style differs in `zIndex` each time, and its cache is made again every 500 operations. So
//             every operation misses, and that one fresh cache is part of the figure, a very small part.
//   hit       one `cache.css(style)` of a style the cache already holds. The same object, and an equal
//             new object, give the same class: the cache is keyed by the compiled rules, not by the
//             object, so a hit still compiles and hashes the style.
// The engine runs in Node with an in-memory sheet, so the figures leave out what a browser's
// `insertRule` costs.
import type { BenchConfig } from '@soroush.tech/bench'
import {
  createCycle,
  createDistinctStyles,
  createLargeStyle,
  createSmallStyle,
} from '../../../bench/src/styles'
import { core } from './core'

const createFreshCache = () => core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })

// Each case has its own cache. Only the hit cases share a cache, which a call before made warm.
let missCache = createFreshCache()
const nextMiss = createCycle(createDistinctStyles(2000), () => {
  missCache = createFreshCache()
})

let largeMissCache = createFreshCache()
let largeCount = 0
const nextLargeMiss = () => {
  if (largeCount % 500 === 0) largeMissCache = createFreshCache()
  return { ...createLargeStyle(), zIndex: largeCount++ }
}

const hitCache = createFreshCache()
const small = createSmallStyle()
hitCache.css(small)
const large = createLargeStyle()
hitCache.css(large)

export default {
  name: 'core: class creation',
  cases: {
    'miss: a new small style each time': () => missCache.css(nextMiss()),
    'miss: a new large style each time': () => {
      const style = nextLargeMiss()
      return largeMissCache.css(style)
    },
    'hit: the same small style object again': () => hitCache.css(small),
    'hit: an equal small style in a new object': () => hitCache.css(createSmallStyle()),
    'hit: the same large style object again': () => hitCache.css(large),
  },
} satisfies BenchConfig
