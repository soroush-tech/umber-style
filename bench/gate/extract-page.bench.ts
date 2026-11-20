// One operation: `extractPageStyles(cache, html, { themes })` for one page of ten, 300 elements, over a
// cache that holds the classes of all ten pages. Same work as core/extraction.bench.ts.
import type { BenchConfig } from '@soroush.tech/bench'
import * as local from '../../packages/core/dist/index.cjs'
import { createSmallTheme } from '../src/themes'
import { previousCore } from './baseline'
import { createSides } from './support'

const PAGES = 10
const CLASSES_PER_PAGE = 40
const ELEMENTS = 300

/** The finished HTML of a page: each element has one or two of the page's classes. */
function createPageHtml(classes: readonly string[], themeClass: string): string {
  const body = Array.from({ length: ELEMENTS }, (_, index) => {
    const own = classes[index % classes.length]
    const second = index % 3 === 0 ? ` ${classes[(index + 7) % classes.length]}` : ''
    return `<div class="${own}${second}" data-index="${index}"><span>item ${index}</span></div>`
  }).join('')
  return `<html><body class="${themeClass}"><main>${body}</main></body></html>`
}

export default {
  name: 'core: extracting the CSS of a page',
  packages: { previous: previousCore },
  cases: createSides(local, (core) => {
    const theme = createSmallTheme()
    const engine = core.createEngine(theme, {
      prefix: 'b',
      cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet() }),
    })
    const { palette, space, radii } = engine.refs
    const colors = Object.values(palette)
    const pages = Array.from({ length: PAGES }, (_, page) =>
      Array.from({ length: CLASSES_PER_PAGE }, (_, index) =>
        engine.css({
          color: colors[index % colors.length],
          padding: space[index % space.length],
          borderRadius: radii.md,
          margin: page * 100 + index,
          '&:hover': { opacity: 0.5 },
        })
      )
    )
    const themeClass = engine.themeClass(theme)
    const html = createPageHtml(pages[3], themeClass)
    return () => core.extractPageStyles(engine.cache, html, { themes: [themeClass] })
  }),
} satisfies BenchConfig
