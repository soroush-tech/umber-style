// What one operation is, in this file: one `themed.resolve(view)` of a sheet made from a function of the
// theme. "A new view" walks a pool of 500 theme views, each a different object, so the function runs
// and its five entries are made; the sheet (and its engine) is made again each time the pool comes
// round, one for each 500 operations, which is part of the figure. "The same view" is the WeakMap hit.
// Each sheet has its own engine and cache, with an in-memory sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import { createCycle } from '../../../bench/src/styles'
import { cloneTheme, createSmallTheme, type SmallTheme } from '../../../bench/src/themes'
import type { WebStyleObject } from '../src/index'
import { core } from './core'

const small = createSmallTheme()

const createFunctionSheet = (
  theme: SmallTheme
): Record<'root' | 'title' | 'body' | 'footer' | 'icon', WebStyleObject> => ({
  root: { display: 'flex', padding: theme.space[2], color: theme.palette.text },
  title: { fontSize: theme.fontSizes.lg, fontWeight: 700 },
  body: { fontSize: theme.fontSizes.md, color: theme.palette.text },
  footer: { marginTop: theme.space[4], '&:hover': { opacity: 0.5 } },
  icon: { width: theme.space[4], height: theme.space[4], borderRadius: theme.radii.sm },
})

const makeSheet = () =>
  core
    .createEngine(small, {
      prefix: 'b',
      cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet() }),
    })
    .createSheet(createFunctionSheet)

// Any object is a theme to resolve: these stand for the views that a provider gives.
const views = Array.from({ length: 500 }, () => cloneTheme(small))
let themed = makeSheet()
const nextView = createCycle(views, () => {
  themed = makeSheet()
})
const same = makeSheet()
same.resolve(views[0])

export default {
  name: 'core: function sheets',
  cases: {
    'function sheet, resolved for a new view': () => themed.resolve(nextView()),
    'function sheet, resolved for the same view again': () => same.resolve(views[0]),
  },
} satisfies BenchConfig
