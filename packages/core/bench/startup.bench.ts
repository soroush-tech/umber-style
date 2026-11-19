// @vitest-environment jsdom
// What one operation is, in this file:
//   scan style text  one `scanStyleText(prefix, text)` of the CSS a server sent: 400 classes (about 800
//                    rules with the theme class and the layer order). It is the part of start-up that
//                    reads what the page already has.
//   start the cache  one `createCache({ prefix })` in a document whose head holds that style element: it
//                    reads the options stamp, finds the element, scans it, and starts the observer
//                    that watches for style elements that arrive later.
//   dev checks       one `findMissingStyles(document, { prefix })`, the pass that the development mode runs
//                    a quarter of a second after rules arrive: it walks every element of a page of 100
//                    elements with engine classes and asks jsdom for the computed style of each.
// This file runs in jsdom, whose style element and sheet are not a browser's. The real-browser figure
// for start-up is measured elsewhere (the end-to-end fixtures), so treat these as the cost of the
// engine's own reading, not of the page. Each `createCache` leaves an observer on `<head>`; none of
// them is ever notified, since nothing changes the head while the cases run.
import {
  createCache,
  createEngine,
  createMemorySheet,
  createStyleTag,
  findMissingStyles,
} from '../src'
import { scanStyleText } from '../src/scanStyleText'
import { runGroup } from '@umber-bench/shared/harness'
import { createSmallTheme, type SmallTheme } from '@umber-bench/shared/themes'

/** The element a server would send for a cache that holds 400 classes. */
function createServerTag(): string {
  const theme = createSmallTheme()
  const engine = createEngine<SmallTheme>(theme, {
    prefix: 'b',
    cache: createCache({ prefix: 'b', sheet: createMemorySheet(), hasDevChecks: false }),
  })
  const { palette, space } = engine.refs
  const colors = Object.values(palette)
  for (let index = 0; index < 400; index++) {
    engine.css({
      color: colors[index % colors.length],
      padding: space[index % space.length],
      margin: index,
      '&:hover': { opacity: 0.5 },
    })
  }
  engine.themeClass(theme)
  return createStyleTag(engine.cache)
}

it('dev checks', async (context) => {
  const theme = createSmallTheme()
  const engine = createEngine<SmallTheme>(theme, {
    prefix: 'd',
    cache: createCache({ prefix: 'd', hasDevChecks: false }),
  })
  const { palette, space } = engine.refs
  const colors = Object.values(palette)
  const body = Array.from({ length: 100 }, (_, index) => {
    const own = engine.css({
      color: colors[index % colors.length],
      padding: space[index % space.length],
      margin: index,
    })
    return `<div class="${own}">item ${index}</div>`
  }).join('')
  document.body.className = engine.themeClass(theme)
  document.body.innerHTML = body
  await runGroup(context, 'dev checks', [
    {
      name: 'findMissingStyles: a page of 100 elements',
      fn: () => findMissingStyles(document, { prefix: 'd' }),
    },
  ])
})

it('start-up', async (context) => {
  const tag = createServerTag()
  const text = tag.slice(tag.indexOf('>') + 1, tag.lastIndexOf('</style>'))
  // The page is set up once and not changed while the cases run: a change of the head would notify
  // every observer that earlier operations left behind.
  document.head.innerHTML = tag
  await runGroup(context, 'start-up', [
    { name: 'scanStyleText: 400 classes', fn: () => scanStyleText('b', text) },
    {
      name: 'createCache: reads a style element with 400 classes',
      fn: () => createCache({ prefix: 'b', hasDevChecks: false }),
    },
  ])
})
