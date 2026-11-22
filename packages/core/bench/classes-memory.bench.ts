// What one operation is, in this file: a cache after many distinct styles, read by what soroush-bench
// reports for each operation (`alloc/iter`, the memory one operation allocates), next to its time.
//   new small   a fresh cache over an in-memory sheet, then `cache.css(style)` of 1000 distinct small
//               styles: 1000 classes compiled, named, registered and inserted (2000 rules).
//   new large   the same with 1000 distinct large styles (more than 50 declarations each).
//   again       the 1000 small styles again, over a cache that holds them: what a hit allocates.
// The memory a cache keeps after the operation is not measured on its own: what is allocated includes
// what is dropped again.
import type { BenchConfig } from '@soroush.tech/bench'
import { createDistinctStyles, createLargeStyle } from '../../../bench/src/styles'
import type { WebStyleObject } from '../src/index'
import { core } from './core'

const COUNT = 1000

const small = createDistinctStyles(COUNT)
const large = Array.from({ length: COUNT }, (_, index) => ({
  ...createLargeStyle(),
  zIndex: index,
}))
const createFreshCache = () => core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })

/** A fresh cache with a class for each of `styles`. */
const fillCache = (styles: readonly WebStyleObject[]) => {
  const cache = createFreshCache()
  for (const style of styles) cache.css(style)
  return cache
}

const held = fillCache(small)

export default {
  name: 'core: a cache after 1000 distinct styles',
  cases: {
    'a fresh cache, then 1000 new small styles': () => fillCache(small),
    'a fresh cache, then 1000 new large styles': () => fillCache(large),
    'the 1000 small styles again, over a cache that holds them': () => {
      for (const style of small) held.css(style)
      return held
    },
  },
} satisfies BenchConfig
