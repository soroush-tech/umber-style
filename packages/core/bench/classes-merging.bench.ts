// What one operation is, in this file: one `cache.css(classA, classB, ...)` of classes the cache made:
// they are resolved back to their styles, merged, compiled and found again (a hit). "With a new object"
// merges one class with a style object given in the call. The cache is made once, before the cases,
// with an in-memory sheet, and holds every merge already.
import type { BenchConfig } from '@soroush.tech/bench'
import { core } from './core'

const cache = core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })
const classes = Array.from({ length: 5 }, (_, index) =>
  cache.css({ color: 'red', padding: index + 1, '&:hover': { opacity: index / 10 } })
)
cache.css(classes[0], classes[1])
cache.css(...classes)

export default {
  name: 'core: merging classes',
  cases: {
    'merge two classes': () => cache.css(classes[0], classes[1]),
    'merge five classes': () => cache.css(...classes),
    'merge a class with a new object': () => cache.css(classes[0], { margin: 4 }),
  },
} satisfies BenchConfig
