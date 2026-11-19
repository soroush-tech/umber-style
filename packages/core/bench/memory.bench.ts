// What this file reports, and how: it is not a timing. Each figure is the growth of the V8 heap
// (`process.memoryUsage().heapUsed`) across a piece of work, with a full collection forced before and
// after when the runner exposes it (`--expose-gc`, which this package's bench config passes); a figure
// that says "collected: no" is only indicative. The work is a styled component's styler asked for a class
// with 5,000 prop combinations: 5,000 distinct ones (each makes a class and its rules), and 5,000 repeats
// of one (the same class found each time). The cache holds its rules in memory sheet text, as it does on
// a server; a browser's sheet keeps its own copy of each rule outside this heap. Nothing is asserted.
import { createCache, createEngine, createMemorySheet } from '../src'
import { measureHeap, recordMemory } from '@umber-bench/shared/harness'
import { createCombinations, LAYOUT_FIXED, createLayoutStyle } from '@umber-bench/shared/styles'
import type { LayoutProps } from '@umber-bench/shared/styles'
import { createSmallTheme } from '@umber-bench/shared/themes'

const COUNT = 5000

/** A styler for the layout component over a new engine. */
function createLayoutStyler() {
  const theme = createSmallTheme()
  const cache = createCache({ prefix: 'b', sheet: createMemorySheet() })
  const engine = createEngine(theme, { prefix: 'b', cache })
  const styler = engine.createStyler({ name: 'Flex' }, [
    LAYOUT_FIXED,
    (props: LayoutProps) => createLayoutStyle(props),
  ])
  return { cache, styler, view: engine.createThemeView(theme) }
}

it('heap growth of the class cache', (context) => {
  const distinct = createCombinations(COUNT)
  const first = createLayoutStyler()
  const grownDistinct = measureHeap(() => {
    for (const props of distinct) first.styler.getClassName({ ...props }, undefined, first.view)
    return first
  })
  const classes = first.cache.extract().ids.length
  recordMemory(
    context,
    '5000 distinct props classes',
    `${COUNT} distinct prop combinations of the layout component; the cache then holds ${classes} ids`,
    grownDistinct
  )

  const repeated = createLayoutStyler()
  const same = createCombinations(1)[0]
  const grownRepeated = measureHeap(() => {
    for (let index = 0; index < COUNT; index++) {
      repeated.styler.getClassName({ ...same }, undefined, repeated.view)
    }
    return repeated
  })
  recordMemory(
    context,
    '5000 repeats of one props class',
    `${COUNT} calls with the same props; the cache holds ${repeated.cache.extract().ids.length} ids`,
    grownRepeated
  )
})
