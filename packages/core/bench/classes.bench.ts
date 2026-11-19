// What one operation is, in this file:
//   miss      one `cache.css(style)` of a style the cache has not seen: it compiles the rules, names the
//             class, and inserts the rules into an in-memory sheet. A pool of styles is walked in order,
//             and the cache is made again each time the pool comes round, so that every operation misses
//             (that one fresh cache for each 2000 operations is part of the figure, a very small part).
//   hit       one `cache.css(style)` of a style the cache already holds. The same object, and an equal
//             new object, give the same class: the cache is keyed by the compiled rules, not by the
//             object, so a hit still compiles and hashes the style.
//   merge     one `cache.css(classA, classB, ...)` of classes the cache made: they are resolved back to
//             their styles, merged, compiled and found again (a hit).
//   to rules  one `compileRules` of a style object: the serializer alone, with no cache and no hash.
// The engine runs in Node with an in-memory sheet, so the figures leave out what a browser's
// `insertRule` costs.
import { compileRules, createCache, createMemorySheet, mergeStyles } from '../src'
import type { StyleObject } from '../src'
import { runGroup } from '@umber-bench/shared/harness'
import {
  createCycle,
  createDistinctStyles,
  createLargeStyle,
  createSmallStyle,
} from '@umber-bench/shared/styles'

const createFreshCache = () => createCache({ prefix: 'b', sheet: createMemorySheet() })

it('class creation', async (context) => {
  // Each case has its own cache. Only the hit cases share a cache with a warm-up call.
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

  await runGroup(context, 'class creation', [
    { name: 'miss: a new small style each time', fn: () => missCache.css(nextMiss()) },
    {
      name: 'miss: a new large style each time',
      fn: () => {
        const style = nextLargeMiss()
        return largeMissCache.css(style)
      },
    },
    { name: 'hit: the same small style object again', fn: () => hitCache.css(small) },
    {
      name: 'hit: an equal small style in a new object',
      fn: () => hitCache.css(createSmallStyle()),
    },
    { name: 'hit: the same large style object again', fn: () => hitCache.css(large) },
  ])
})

it('merging classes', async (context) => {
  const cache = createFreshCache()
  const classes = Array.from({ length: 5 }, (_, index) =>
    cache.css({ color: 'red', padding: index + 1, '&:hover': { opacity: index / 10 } })
  )
  cache.css(classes[0], classes[1])
  cache.css(...classes)
  await runGroup(context, 'merging classes', [
    { name: 'merge two classes', fn: () => cache.css(classes[0], classes[1]) },
    { name: 'merge five classes', fn: () => cache.css(...classes) },
    {
      name: 'merge a class with a new object',
      fn: () => cache.css(classes[0], { margin: 4 }),
    },
  ])
})

it('style object to rules', async (context) => {
  const small = createSmallStyle() as StyleObject
  const large = createLargeStyle() as StyleObject
  await runGroup(context, 'style object to rules', [
    { name: 'compile a small style object', fn: () => compileRules('.b-x', small) },
    { name: 'compile a large style object', fn: () => compileRules('.b-x', large) },
    { name: 'merge one large style object', fn: () => mergeStyles([large]) },
  ])
})
