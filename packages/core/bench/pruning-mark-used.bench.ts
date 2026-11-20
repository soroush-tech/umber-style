// What one operation is, in this file:
//   new        one `cache.markUsed([name])` of a variable of the large theme's palette that no rule used
//              before, with five theme classes of the large theme registered: the variable is declared in
//              each of the five (the sheet replaces the theme's rule five times). The 127 names of the
//              palette are walked in order, and the cache with its five theme classes is made again each
//              time they come round, so the theme rules grow from none to 127 variables in each pass, as
//              they did in one operation of the old file (127 calls, divided by 127 for one variable).
//              That fresh cache, one for each 127 operations, is part of the figure: the third case is
//              what it costs, so 1/127 of it can be taken off.
//   used       the same call for a variable that is used already, on a cache where all 127 are.
//   fresh      one fresh cache with the five theme classes of the large theme, the setup of "new".
import type { BenchConfig } from '@soroush.tech/bench'
import { createCycle } from '../../../bench/src/styles'
import { cloneTheme, createLargeTheme } from '../../../bench/src/themes'
import { core } from './core'

const large = createLargeTheme()
const names = Object.keys(core.createEngine(large, { prefix: 'b' }).refs.palette)
  .slice(0, 127)
  .map((key) => `--b-palette-${key}`)
const themes = Array.from({ length: 5 }, (_, index) => {
  const theme = cloneTheme(large)
  theme.palette.text = `#00000${index}`
  return theme
})

/** A cache with the five theme classes registered, and no variable used. */
const createFiveThemes = () => {
  const engine = core.createEngine(large, {
    prefix: 'b',
    cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet() }),
  })
  for (const theme of themes) engine.themeClass(theme)
  return engine.cache
}

let cache = createFiveThemes()
const nextNew = createCycle(names, () => {
  cache = createFiveThemes()
})
const used = createFiveThemes()
used.markUsed(names)
const nextUsed = createCycle(names)

export default {
  name: 'core: marking variables used',
  cases: {
    'mark used: a new variable, five theme classes': () => cache.markUsed([nextNew()]),
    'mark used: a variable that is used already': () => used.markUsed([nextUsed()]),
    'a fresh cache with five theme classes': () => createFiveThemes(),
  },
} satisfies BenchConfig
