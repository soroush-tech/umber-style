// What one operation is, in this file:
//   theme class    one `engine.themeClass(theme)`: declare, hash, and register the class. "New object"
//                  walks a pool of themes that differ in one value, so each is a new class; the engine is
//                  made again each time the pool comes round (one engine for each 100 operations is part
//                  of the figure). "Same object" is the engine's own memo, a WeakMap lookup.
//   nested partial one `engine.themeClass(partial)` of a theme that holds one token, as a nested
//                  provider gives, over an engine whose base is the large theme. A pool of 2000 partials
//                  that differ in that token is walked, and the engine is made again each time it comes
//                  round (one engine for each 2000 operations is part of the figure).
// Each case has its own engine, whose rules say they use a few variables, as a page's rules do. Nothing
// here touches a sheet but an in-memory one.
import type { BenchConfig } from '@soroush.tech/bench'
import { createCycle } from '../../../bench/src/styles'
import {
  cloneTheme,
  createLargeTheme,
  createSmallTheme,
  type LargeTheme,
  type SmallTheme,
} from '../../../bench/src/themes'
import { core } from './core'

const small = createSmallTheme()
const large = createLargeTheme()

/** `count` themes that are different objects and differ from each other in the primary colour. */
function createSmallVariants(count: number): SmallTheme[] {
  return Array.from({ length: count }, (_, index) => {
    const theme = cloneTheme(small)
    theme.palette.primary = `#${(index + 1).toString(16).padStart(6, '0')}`
    return theme
  })
}

function createLargeVariants(count: number): LargeTheme[] {
  return Array.from({ length: count }, (_, index) => {
    const theme = cloneTheme(large)
    theme.palette.text = `#${(index + 1).toString(16).padStart(6, '0')}`
    return theme
  })
}

/** An engine for `theme` whose rules say they use a few variables, as a page's rules do. */
function createUsedEngine<T extends object>(theme: T, used: readonly string[]) {
  const engine = core.createEngine(theme, {
    prefix: 'b',
    cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet() }),
  })
  engine.cache.markUsed(used)
  return engine
}

const usedSmall = ['--b-palette-primary', '--b-palette-text', '--b-space-2', '--b-radii-md']
const usedLarge = [
  '--b-palette-text',
  '--b-palette-primary',
  '--b-palette-blue500',
  '--b-space-4',
  '--b-space-8',
  '--b-radii-r3',
  '--b-font-sizes-f4',
]

let smallEngine = createUsedEngine(small, usedSmall)
const nextSmall = createCycle(createSmallVariants(100), () => {
  smallEngine = createUsedEngine(small, usedSmall)
})
let largeEngine = createUsedEngine(large, usedLarge)
const nextLarge = createCycle(createLargeVariants(100), () => {
  largeEngine = createUsedEngine(large, usedLarge)
})

const smallSame = createUsedEngine(small, usedSmall)
smallSame.themeClass(small)
const largeSame = createUsedEngine(large, usedLarge)
largeSame.themeClass(large)

const partials = Array.from({ length: 2000 }, (_, index) => ({
  palette: { primary: `#${(index + 1).toString(16).padStart(6, '0')}` },
}))
const createPartialEngine = () => {
  const engine = createUsedEngine(large, usedLarge)
  engine.themeClass(large)
  return engine
}
let partialEngine = createPartialEngine()
const nextPartial = createCycle(partials, () => {
  partialEngine = createPartialEngine()
})

export default {
  name: 'core: theme classes',
  cases: {
    'theme class: small theme, a new object': () => smallEngine.themeClass(nextSmall()),
    'theme class: large theme, a new object': () => largeEngine.themeClass(nextLarge()),
    'theme class: small theme, the same object': () => smallSame.themeClass(small),
    'theme class: large theme, the same object': () => largeSame.themeClass(large),
    'nested partial theme: one token, over a large base theme': () =>
      partialEngine.themeClass(nextPartial()),
  },
} satisfies BenchConfig
