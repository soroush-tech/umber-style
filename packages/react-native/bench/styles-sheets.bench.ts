// What one operation is, in this file, with the built React Native binding over the stand-in platform
// module in `platform.ts` (a `StyleSheet.create` that returns its input):
//   function sheet   one `sheet.resolve(theme)` of a sheet made from a function of the theme. "A new
//                    theme" walks a pool of 500 theme objects, so the function runs and its entries are
//                    registered with the platform; the sheet is made again each time the pool comes
//                    round (one sheet for each 500 operations is part of the figure). "The same theme"
//                    is the WeakMap hit.
//   object sheet     one read of an entry of a sheet given as an object.
// The platform's own cost (style registration across the bridge) is not here.
import type { BenchConfig } from '@soroush.tech/bench'
import { createCycle } from '../../../bench/src/styles'
import { cloneTheme, type SmallTheme } from '../../../bench/src/themes'
import { createSetup, theme } from './fixtures'

const { style } = createSetup()
const views = Array.from({ length: 500 }, () => cloneTheme(theme))
const create = () =>
  style.StyleSheet.create((value: SmallTheme) => ({
    root: { padding: value.space[2], backgroundColor: value.palette.text },
    title: { fontSize: value.fontSizes.lg, fontWeight: '700' as const },
    body: { fontSize: value.fontSizes.md, color: value.palette.text },
    footer: { marginTop: value.space[4] },
    icon: { width: value.space[4], height: value.space[4], borderRadius: value.radii.sm },
  })) as unknown as { resolve(value: SmallTheme): unknown }
let themed = create()
const nextView = createCycle(views, () => {
  themed = create()
})
const same = create()
same.resolve(views[0])
const objectSheet = style.StyleSheet.create({ root: { margin: 4 }, other: { margin: 8 } })

export default {
  name: 'react native: sheets',
  cases: {
    'function sheet, resolved for a new theme': () => themed.resolve(nextView()),
    'function sheet, resolved for the same theme again': () => same.resolve(views[0]),
    'object sheet, a later access of an entry': () => objectSheet.root,
  },
} satisfies BenchConfig
