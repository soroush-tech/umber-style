// What one operation is, in this file: one `engine.css(style)` of an engine over a cache with an
// in-memory sheet, with the memo of contents off (the default) and on (`hasStyleMemo`), side by side.
//   two values     `{ fontSize: 12 }` and `{ fontSize: 48 }` in turn, a new object each call: a style
//                  written with a condition in a component
//   small, 4       the small style with one of four `zIndex` values, a new object each call
//   large, 4       the large style (nested selectors and at-rules, two levels deep) made anew each call,
//                  with one of four `zIndex` values
//   nested, 4      a style with a hover key and a media key, one of four, a new object each call
//   same object    the same small style object again
//   never repeats  `{ left: n }` with a new number each call, a fresh engine every 2000 calls: what the
//                  memo costs when nothing in it is ever found again
// Each case has an engine of its own, made warm before the measurement where it can be.
import type { BenchConfig } from '@soroush.tech/bench'
import { createLargeStyle, createSmallStyle } from '../../../bench/src/styles'
import { core } from './core'

const createFreshEngine = (hasStyleMemo: boolean) =>
  core.createEngine(
    {},
    { cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet(), hasStyleMemo }) }
  )

/** The cases of one state of the option. */
function createCases(hasStyleMemo: boolean, state: string) {
  const twoValues = createFreshEngine(hasStyleMemo)
  const small = createFreshEngine(hasStyleMemo)
  const large = createFreshEngine(hasStyleMemo)
  const nested = createFreshEngine(hasStyleMemo)
  const same = createFreshEngine(hasStyleMemo)
  const sameStyle = createSmallStyle()
  let never = createFreshEngine(hasStyleMemo)
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
    [`the same small style object again, ${state}`]: () => same.css(sameStyle),
    [`a style that never repeats, ${state}`]: () => {
      if (left % 2000 === 0) never = createFreshEngine(hasStyleMemo)
      return never.css({ left: left++ })
    },
  }
}

export default {
  name: 'core: the same contents in a new object',
  cases: { ...createCases(false, 'memo off'), ...createCases(true, 'memo on') },
} satisfies BenchConfig
