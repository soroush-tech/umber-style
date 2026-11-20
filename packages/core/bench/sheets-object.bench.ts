// What one operation is, in this file:
//   first access   one `createSheet({ ...5 entries })` (a new object each time, on one engine) and one read
//                  of its first entry: the lazy record is made, and the entry's rules are compiled and
//                  named (nothing is inserted until the entry is used).
//   later access   one read of an entry of a sheet that was read before: the record's own memo.
//   as a class     `cache.css(entry)`: the class of the one entry, written the first time and found after
//                  that.
// Each case has its own engine and cache, with an in-memory sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import { createSmallTheme } from '../../../bench/src/themes'
import type { WebStyleObject } from '../src/index'
import { core } from './core'

const small = createSmallTheme()

const createEngineFor = () =>
  core.createEngine(small, {
    prefix: 'b',
    cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet() }),
  })

const createObjectSheet = () => ({
  root: { display: 'flex', padding: 8 } satisfies WebStyleObject,
  title: { fontSize: 18, fontWeight: 700 } satisfies WebStyleObject,
  body: { fontSize: 14, color: 'gray' } satisfies WebStyleObject,
  footer: { marginTop: 16, '&:hover': { opacity: 0.5 } } satisfies WebStyleObject,
  icon: { width: 16, height: 16 } satisfies WebStyleObject,
})

const firstEngine = createEngineFor()
const sheet = firstEngine.createSheet(createObjectSheet())
// Reading the entry makes the sheet's record keep it, so that the later reads are the memo.
Reflect.get(sheet, 'root')
const usedEngine = createEngineFor()
const usedSheet = usedEngine.createSheet(createObjectSheet())
usedEngine.cache.css(usedSheet.root)

export default {
  name: 'core: object sheets',
  cases: {
    'object sheet, first access of an entry': () =>
      firstEngine.createSheet(createObjectSheet()).root,
    'object sheet, a later access of an entry': () => sheet.root,
    'object sheet, entry used as a class': () => usedEngine.cache.css(usedSheet.root),
  },
} satisfies BenchConfig
