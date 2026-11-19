// What one operation is, in this file:
//   extract        one `cache.extract()` of a cache that holds 400 classes (about 800 rules with the
//                  theme classes): the rules joined into one text, and the list of ids.
//   style tag      one `createStyleTag(cache)`: `extract()` and the element around it.
//   page           one `extractPageStyles(cache, html, { themes })` for one page, of a cache that holds
//                  the classes of ten pages (40 classes each). The HTML has 300 elements. Result: the CSS
//                  of the one page, and the theme classes trimmed to the variables that page uses.
//   scan HTML      one `scanHtml(html)` of that page: the pass that reads the class attributes.
// The cache is built once, before the cases, and is not changed by any of them (extraction only reads).
import {
  createCache,
  createEngine,
  createMemorySheet,
  createStyleTag,
  extractPageStyles,
} from '../src'
import { scanHtml } from '../src/scanHtml'
import { runGroup } from '@umber-bench/shared/harness'
import { createSmallTheme, type SmallTheme } from '@umber-bench/shared/themes'

const PAGES = 10
const CLASSES_PER_PAGE = 40
const ELEMENTS_PER_PAGE = 300

/** An engine whose cache holds the classes of ten pages, each class using the theme through references. */
function createPagesEngine() {
  const theme = createSmallTheme()
  const engine = createEngine<SmallTheme>(theme, {
    prefix: 'b',
    cache: createCache({ prefix: 'b', sheet: createMemorySheet() }),
  })
  const { palette, space, radii } = engine.refs
  const colors = Object.values(palette)
  const pages: string[][] = []
  for (let page = 0; page < PAGES; page++) {
    const classes: string[] = []
    for (let index = 0; index < CLASSES_PER_PAGE; index++) {
      classes.push(
        engine.css({
          color: colors[index % colors.length],
          padding: space[index % space.length],
          borderRadius: radii.md,
          margin: page * 100 + index,
          '&:hover': { opacity: 0.5 },
        })
      )
    }
    pages.push(classes)
  }
  const themeClass = engine.themeClass(theme)
  return { engine, pages, themeClass }
}

/** The finished HTML of a page: `count` elements, each with one or two of the page's classes. */
function createPageHtml(classes: readonly string[], themeClass: string, count: number): string {
  const body = Array.from({ length: count }, (_, index) => {
    const own = classes[index % classes.length]
    const second = index % 3 === 0 ? ` ${classes[(index + 7) % classes.length]}` : ''
    return `<div class="${own}${second}" data-index="${index}"><span>item ${index}</span></div>`
  }).join('')
  return `<html><body class="${themeClass}"><main>${body}</main></body></html>`
}

it('extraction', async (context) => {
  const { engine, pages, themeClass } = createPagesEngine()
  const html = createPageHtml(pages[3], themeClass, ELEMENTS_PER_PAGE)
  const { cache } = engine
  await runGroup(context, 'extraction', [
    { name: 'extract: a cache with 400 classes', fn: () => cache.extract() },
    { name: 'createStyleTag: a cache with 400 classes', fn: () => createStyleTag(cache) },
    {
      name: 'extractPageStyles: one page of ten, 300 elements',
      fn: () => extractPageStyles(cache, html, { themes: [themeClass] }),
    },
    { name: 'scanHtml: 300 elements', fn: () => scanHtml(html) },
  ])
})
