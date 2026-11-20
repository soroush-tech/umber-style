// One operation: `engine.themeClass(theme)` of a large theme the engine has not seen (a pool of 100
// themes that differ in one value; the engine is made again each time the pool comes round). Same work
// as core/tokens.bench.ts.
import type { BenchConfig } from '@soroush.tech/bench'
import * as local from '../../packages/core/dist/index.cjs'
import { createCycle } from '../src/styles'
import { cloneTheme, createLargeTheme } from '../src/themes'
import { previousCore } from './baseline'
import { createSides } from './support'

const USED = ['--b-palette-text', '--b-palette-primary', '--b-space-4', '--b-radii-r3']

export default {
  name: 'core: a new theme class',
  packages: { previous: previousCore },
  cases: createSides(local, (core) => {
    const base = createLargeTheme()
    const variants = Array.from({ length: 100 }, (_, index) => {
      const theme = cloneTheme(base)
      theme.palette.text = `#${(index + 1).toString(16).padStart(6, '0')}`
      return theme
    })
    const fresh = () => {
      const engine = core.createEngine(base, {
        prefix: 'b',
        cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet() }),
      })
      engine.cache.markUsed(USED)
      return engine
    }
    let engine = fresh()
    const next = createCycle(variants, () => {
      engine = fresh()
    })
    return () => engine.themeClass(next())
  }),
} satisfies BenchConfig
