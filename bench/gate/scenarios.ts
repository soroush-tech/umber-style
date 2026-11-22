// The scenarios of the gate, each written once over the API of the core: the gate files in this folder run
// them on the current build and the build of the last release, and the report files in `bench/report/`
// on versions installed from npm. What one operation is, is said above each one.
import {
  createCycle,
  createDistinctStyles,
  createLargeStyle,
  createSmallStyle,
} from '../src/styles'
import { cloneTheme, createLargeTheme, createSmallTheme } from '../src/themes'
import type { CoreModule, Scenario } from './support'

/** A cache over an in-memory sheet. */
const createFreshCache = (core: CoreModule) =>
  core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })

/**
 * One operation: `cache.css(style)` of a small style the cache has not seen (a pool of 2000 is walked,
 * and the cache is made again each time the pool comes round). Same work as
 * core/classes-creation.bench.ts.
 */
export const classMissSmall: Scenario = {
  name: 'core: a new small style',
  build: (core) => {
    let cache = createFreshCache(core)
    const next = createCycle(createDistinctStyles(2000), () => {
      cache = createFreshCache(core)
    })
    return () => cache.css(next())
  },
}

/**
 * One operation: `cache.css(style)` of a large style (more than 50 declarations, pseudo selectors, media
 * and supports queries) that the cache has not seen: `zIndex` differs each time, and the cache is made
 * again every 500 operations. Same work as core/classes-creation.bench.ts.
 */
export const classMissLarge: Scenario = {
  name: 'core: a new large style',
  build: (core) => {
    let cache = createFreshCache(core)
    let count = 0
    return () => {
      if (count % 500 === 0) cache = createFreshCache(core)
      const style = { ...createLargeStyle(), zIndex: count }
      count += 1
      return cache.css(style)
    }
  },
}

/**
 * One operation: `cache.css(style)` of the same small style object again, over a cache that holds it (a
 * hit still compiles and hashes the style). Same work as core/classes-creation.bench.ts.
 */
export const classHit: Scenario = {
  name: 'core: the same style again',
  build: (core) => {
    const cache = createFreshCache(core)
    const style = createSmallStyle()
    cache.css(style)
    return () => cache.css(style)
  },
}

/**
 * One operation: `cache.css(a, b, c, d, e)`, five classes the cache made, resolved back to their styles,
 * merged, compiled and found again. Same work as core/classes-merging.bench.ts.
 */
export const classMerge: Scenario = {
  name: 'core: merging five classes',
  build: (core) => {
    const cache = createFreshCache(core)
    const classes = Array.from({ length: 5 }, (_, index) =>
      cache.css({ color: 'red', padding: index + 1, '&:hover': { opacity: index / 10 } })
    )
    cache.css(...classes)
    return () => cache.css(...classes)
  },
}

/**
 * One operation: `createTokens(theme)` of the large theme (about 280 tokens) and `declare(theme)`, the
 * variable declarations of it. Same work as core/tokens-references.bench.ts.
 */
export const themeTokens: Scenario = {
  name: 'core: a theme and its variables',
  build: (core) => {
    const theme = createLargeTheme()
    return () => core.createTokens(theme, { prefix: 'b' }).declare(theme)
  },
}

const USED = ['--b-palette-text', '--b-palette-primary', '--b-space-4', '--b-radii-r3']

/**
 * One operation: `engine.themeClass(theme)` of a large theme the engine has not seen (a pool of 100
 * themes that differ in one value; the engine is made again each time the pool comes round). Same work
 * as core/tokens-theme-classes.bench.ts.
 */
export const themeClass: Scenario = {
  name: 'core: a new theme class',
  build: (core) => {
    const base = createLargeTheme()
    const variants = Array.from({ length: 100 }, (_, index) => {
      const theme = cloneTheme(base)
      theme.palette.text = `#${(index + 1).toString(16).padStart(6, '0')}`
      return theme
    })
    const fresh = () => {
      const engine = core.createEngine(base, { prefix: 'b', cache: createFreshCache(core) })
      engine.cache.markUsed(USED)
      return engine
    }
    let engine = fresh()
    const next = createCycle(variants, () => {
      engine = fresh()
    })
    return () => engine.themeClass(next())
  },
}

const PAGES = 10
const CLASSES_PER_PAGE = 40
const ELEMENTS = 300

/** The finished HTML of a page: each element has one or two of the page's classes. */
function createPageHtml(classes: readonly string[], themeClassName: string): string {
  const body = Array.from({ length: ELEMENTS }, (_, index) => {
    const own = classes[index % classes.length]
    const second = index % 3 === 0 ? ` ${classes[(index + 7) % classes.length]}` : ''
    return `<div class="${own}${second}" data-index="${index}"><span>item ${index}</span></div>`
  }).join('')
  return `<html><body class="${themeClassName}"><main>${body}</main></body></html>`
}

/**
 * One operation: `extractPageStyles(cache, html, { themes })` for one page of ten, 300 elements, over a
 * cache that holds the classes of all ten pages. Same work as core/extraction.bench.ts.
 */
export const extractPage: Scenario = {
  name: 'core: extracting the CSS of a page',
  build: (core) => {
    const theme = createSmallTheme()
    const engine = core.createEngine(theme, { prefix: 'b', cache: createFreshCache(core) })
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
    const themeClassName = engine.themeClass(theme)
    const html = createPageHtml(pages[3], themeClassName)
    return () => core.extractPageStyles(engine.cache, html, { themes: [themeClassName] })
  },
}
