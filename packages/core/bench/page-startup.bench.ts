// What one operation is, in this file: the part of start-up that reads what a page already has, in jsdom.
//   scan    one `scanStyleText('b', text)` of the CSS a server sent for a cache of 400 classes (about 800
//           rules with the theme class and the layer order). The built core does not export it, so this
//           case runs the source (`src/scanStyleText.ts`), which tsx compiles in the sandbox.
//   start   one `createCache(...)` over a page whose head holds that style element: it reads the stamp of
//           the options, finds the element, scans it, takes in its classes, themes and variables, and
//           starts the observer that watches for style elements that arrive later.
// The page is a document of jsdom without a window, made once, which gives a style element no style
// sheet: the cache reads the text alone, as it does for an element whose rules the browser did not all
// keep. Its `MutationObserver` is a stand-in that watches nothing: jsdom's keeps every cache it was given
// reachable after its page is gone (about 22 KB a cache, measured in Node), which ran the sandbox out of
// memory in five rounds, and no style element arrives during the case, so a real one would report nothing.
import type { BenchConfig } from '@soroush.tech/bench'
import { createSmallTheme, type SmallTheme } from '../../../bench/src/themes'
import { scanStyleText } from '../src/scanStyleText'
import { core } from './core'
import { window } from './dom'

const CLASSES = 400

/** The style element a server would send for a cache that holds 400 classes of the small theme. */
function createServerTag(): string {
  const theme = createSmallTheme()
  const engine = core.createEngine<SmallTheme>(theme, {
    prefix: 'b',
    cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet(), hasDevChecks: false }),
  })
  const { palette, space } = engine.refs
  const colors = Object.values(palette)
  for (let index = 0; index < CLASSES; index++) {
    engine.css({
      color: colors[index % colors.length],
      padding: space[index % space.length],
      margin: index,
      '&:hover': { opacity: 0.5 },
    })
  }
  engine.themeClass(theme)
  return core.createStyleTag(engine.cache)
}

/** An observer that watches nothing and reports nothing. */
class StandInObserver {
  observe(): void {}
  disconnect(): void {}
  takeRecords(): MutationRecord[] {
    return []
  }
}
Object.assign(globalThis, { MutationObserver: StandInObserver })

const tag = createServerTag()
const text = tag.slice(tag.indexOf('>') + 1, tag.lastIndexOf('</style>'))
const page = window.document.implementation.createHTMLDocument('')
page.head.innerHTML = tag

export default {
  name: 'core: reading a page at start-up',
  cases: {
    'scanStyleText: 400 classes (source)': () => scanStyleText('b', text),
    'createCache: reads a page with 400 classes': () =>
      core.createCache({
        prefix: 'b',
        sheet: { ...core.createMemorySheet(), document: page },
        hasDevChecks: false,
      }),
  },
} satisfies BenchConfig
