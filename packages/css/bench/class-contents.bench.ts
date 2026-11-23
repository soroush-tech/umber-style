// What one operation is, in this file: one `css(style)` of an instance of this package
// (`createInstance`, unlayered, an in-memory sheet), with the memo of contents off (the default) and on
// (`hasStyleMemo`), side by side.
//   two values     `{ fontSize: 12 }` and `{ fontSize: 48 }` in turn, a new object each call
//   small, 4       the small style with one of four `zIndex` values, a new object each call
//   large, 4       the large style made anew each call, with one of four `zIndex` values
//   nested, 4      a style with a hover key and a media key, one of four, a new object each call
//   never repeats  `{ left: n }` with a new number each call, a fresh instance every 2000 calls
// The built `dist` is loaded after `prepareBuiltPackages`, which sends the `@umber-style/core` that it
// requires to the built core.
import type { BenchConfig } from '@soroush.tech/bench'
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import { prepareBuiltPackages } from '../../../bench/src/built'
import { createLargeStyle, createSmallStyle } from '../../../bench/src/styles'
import type createInstanceSource from '../src/createInstance'

prepareBuiltPackages()
const load = createRequire(import.meta.url)
const core = load('../../core/dist/index.cjs') as typeof Core
const { default: createInstance } = load('../dist/create-instance.cjs') as {
  default: typeof createInstanceSource
}

const createPlain = (hasStyleMemo: boolean) =>
  createInstance({ key: 'b', sheet: core.createMemorySheet(), hasStyleMemo })

/** The cases of one state of the option. */
function createCases(hasStyleMemo: boolean, state: string) {
  const twoValues = createPlain(hasStyleMemo)
  const small = createPlain(hasStyleMemo)
  const large = createPlain(hasStyleMemo)
  const nested = createPlain(hasStyleMemo)
  let never = createPlain(hasStyleMemo)
  let count = 0
  let left = 0
  return {
    [`two values, a new object each call, ${state}`]: () =>
      twoValues.css({ fontSize: count++ % 2 === 0 ? 12 : 48 }),
    [`small style, one of 4, a new object each call, ${state}`]: () =>
      small.css({ ...createSmallStyle(), zIndex: count++ % 4 }),
    [`large style, one of 4, a new object each call, ${state}`]: () =>
      large.css({ ...createLargeStyle(), zIndex: count++ % 4 }),
    [`nested style, one of 4, a new object each call, ${state}`]: () => {
      const variant = count++ % 4
      return nested.css({
        color: 'red',
        padding: 8 + variant,
        '&:hover': { color: 'blue', opacity: 0.5 + variant / 10 },
        '@media (min-width: 40em)': { padding: 16 + variant },
      })
    },
    [`a style that never repeats, ${state}`]: () => {
      if (left % 2000 === 0) never = createPlain(hasStyleMemo)
      return never.css({ left: left++ })
    },
  }
}

export default {
  name: 'css: the same contents in a new object',
  cases: { ...createCases(false, 'memo off'), ...createCases(true, 'memo on') },
} satisfies BenchConfig
