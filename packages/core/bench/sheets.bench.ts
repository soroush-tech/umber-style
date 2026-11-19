// What one operation is, in this file:
//   object sheet, first access   one `createSheet({ ...5 entries })` (a new object each time, on one engine) and one read of its first
//                                entry: the lazy record is made, and the entry's rules are compiled and
//                                named (nothing is inserted until the entry is used).
//   object sheet, later access   one read of an entry of a sheet that was read before: the record's own
//                                memo. "Used as a class" is `cache.css(entry)`: the class of the one
//                                entry, written the first time and found after that.
//   function sheet, per theme    one `themed.resolve(view)` of a sheet made from a function of the theme.
//                                "A new view" walks a pool of theme views, each a different object, so
//                                the function runs and its five entries are made; the sheet is made
//                                again each time the pool comes round (one sheet for each 500
//                                operations is part of the figure). "The same view" is the WeakMap hit.
// Each case has its own engine and cache, with an in-memory sheet.
import { createCache, createEngine, createMemorySheet } from '../src'
import type { WebStyleObject } from '../src'
import { runGroup } from '@umber-bench/shared/harness'
import { cloneTheme, createSmallTheme, type SmallTheme } from '@umber-bench/shared/themes'

const small = createSmallTheme()

const createEngineFor = () =>
  createEngine(small, {
    prefix: 'b',
    cache: createCache({ prefix: 'b', sheet: createMemorySheet() }),
  })

const createObjectSheet = () => ({
  root: { display: 'flex', padding: 8 } satisfies WebStyleObject,
  title: { fontSize: 18, fontWeight: 700 } satisfies WebStyleObject,
  body: { fontSize: 14, color: 'gray' } satisfies WebStyleObject,
  footer: { marginTop: 16, '&:hover': { opacity: 0.5 } } satisfies WebStyleObject,
  icon: { width: 16, height: 16 } satisfies WebStyleObject,
})

const createFunctionSheet = (
  theme: SmallTheme
): Record<'root' | 'title' | 'body' | 'footer' | 'icon', WebStyleObject> => ({
  root: { display: 'flex', padding: theme.space[2], color: theme.palette.text },
  title: { fontSize: theme.fontSizes.lg, fontWeight: 700 },
  body: { fontSize: theme.fontSizes.md, color: theme.palette.text },
  footer: { marginTop: theme.space[4], '&:hover': { opacity: 0.5 } },
  icon: { width: theme.space[4], height: theme.space[4], borderRadius: theme.radii.sm },
})

it('object sheets', async (context) => {
  const firstEngine = createEngineFor()
  const sheet = firstEngine.createSheet(createObjectSheet())
  // Reading the entry makes the sheet's record keep it, so that the later reads are the memo.
  Reflect.get(sheet, 'root')
  const usedCache = createEngineFor()
  const usedSheet = usedCache.createSheet(createObjectSheet())
  usedCache.cache.css(usedSheet.root)
  await runGroup(context, 'object sheets', [
    {
      name: 'object sheet, first access of an entry',
      fn: () => firstEngine.createSheet(createObjectSheet()).root,
    },
    { name: 'object sheet, a later access of an entry', fn: () => sheet.root },
    { name: 'object sheet, entry used as a class', fn: () => usedCache.cache.css(usedSheet.root) },
  ])
})

it('function sheets', async (context) => {
  // Any object is a theme to resolve: these stand for the views that a provider gives.
  const views = Array.from({ length: 500 }, () => cloneTheme(small))
  const makeSheet = () => createEngineFor().createSheet(createFunctionSheet)
  let themed = makeSheet()
  let index = 0
  const same = makeSheet()
  same.resolve(views[0])
  await runGroup(context, 'function sheets', [
    {
      name: 'function sheet, resolved for a new view',
      fn: () => {
        if (index === views.length) {
          themed = makeSheet()
          index = 0
        }
        return themed.resolve(views[index++])
      },
    },
    {
      name: 'function sheet, resolved for the same view again',
      fn: () => same.resolve(views[0]),
    },
  ])
})
