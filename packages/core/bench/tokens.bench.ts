// What one operation is, in this file:
//   createTokens   one `createTokens(theme)`: the walk over the theme that makes the references
//                  (`var(--name)` in the shape of the theme) and the declarations.
//   theme view     one `tokens.createView(theme)`: the shape of a real theme with a reference for each
//                  token, which a component's function style receives.
//   declare        one `tokens.declare(theme)`: the variable declarations of a theme.
//   theme class    one `engine.themeClass(theme)`: declare, hash, and register the class. "New object"
//                  walks a pool of themes that differ in one value, so each is a new class; the engine is
//                  made again each time the pool comes round (one engine for each 100 operations is part
//                  of the figure; 2000 for the nested partial). "Same object" is the engine's own memo, a WeakMap lookup.
//   nested partial one `engine.themeClass(partial)` of a theme that holds a few of the tokens, as a
//                  nested provider gives.
// Each case has its own engine. Nothing here touches a sheet but an in-memory one.
import { createCache, createEngine, createMemorySheet, createTokens } from '../src'
import { runGroup } from '@umber-bench/shared/harness'
import { createCycle } from '@umber-bench/shared/styles'
import {
  cloneTheme,
  createLargeTheme,
  createSmallTheme,
  type LargeTheme,
  type SmallTheme,
} from '@umber-bench/shared/themes'

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
  const engine = createEngine(theme, {
    prefix: 'b',
    cache: createCache({ prefix: 'b', sheet: createMemorySheet() }),
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

it('tokens and references', async (context) => {
  const smallTokens = createTokens(small, { prefix: 'b' })
  const largeTokens = createTokens(large, { prefix: 'b' })
  await runGroup(context, 'tokens and references', [
    { name: 'createTokens: small theme', fn: () => createTokens(small, { prefix: 'b' }) },
    { name: 'createTokens: large theme', fn: () => createTokens(large, { prefix: 'b' }) },
    { name: 'theme view: small theme', fn: () => smallTokens.createView(small) },
    { name: 'theme view: large theme', fn: () => largeTokens.createView(large) },
    { name: 'declare: small theme', fn: () => smallTokens.declare(small) },
    { name: 'declare: large theme', fn: () => largeTokens.declare(large) },
  ])
})

it('theme classes', async (context) => {
  const smallVariants = createSmallVariants(100)
  let smallEngine = createUsedEngine(small, usedSmall)
  const nextSmall = createCycle(smallVariants, () => {
    smallEngine = createUsedEngine(small, usedSmall)
  })
  const largeVariants = createLargeVariants(100)
  let largeEngine = createUsedEngine(large, usedLarge)
  const nextLarge = createCycle(largeVariants, () => {
    largeEngine = createUsedEngine(large, usedLarge)
  })

  const smallSame = createUsedEngine(small, usedSmall)
  smallSame.themeClass(small)
  const largeSame = createUsedEngine(large, usedLarge)
  largeSame.themeClass(large)

  await runGroup(context, 'theme classes', [
    {
      name: 'theme class: small theme, a new object',
      fn: () => smallEngine.themeClass(nextSmall()),
    },
    {
      name: 'theme class: large theme, a new object',
      fn: () => largeEngine.themeClass(nextLarge()),
    },
    { name: 'theme class: small theme, the same object', fn: () => smallSame.themeClass(small) },
    { name: 'theme class: large theme, the same object', fn: () => largeSame.themeClass(large) },
  ])
})

it('nested partial themes', async (context) => {
  const partials = Array.from({ length: 2000 }, (_, index) => ({
    palette: { primary: `#${(index + 1).toString(16).padStart(6, '0')}` },
  }))
  let engine = createUsedEngine(large, usedLarge)
  engine.themeClass(large)
  const next = createCycle(partials, () => {
    engine = createUsedEngine(large, usedLarge)
    engine.themeClass(large)
  })
  await runGroup(context, 'nested partial themes', [
    {
      name: 'nested partial theme: one token, over a large base theme',
      fn: () => engine.themeClass(next()),
    },
  ])
})
