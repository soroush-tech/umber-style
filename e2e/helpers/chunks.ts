import { expect, type Page } from '@playwright/test'
import { waitForHydrated } from './navigation'
import {
  countEach,
  countRoots,
  fetchHtml,
  findLateClasses,
  findRepeated,
  openWithoutScript,
  readLiveSelectors,
  readSentClasses,
  readSentStyles,
  readStyle,
  type RegistryTools,
} from './registry'

// The page of the Vike fixture that is rendered with `@umber-style/server/create-instance`
// (`src/pages/chunks`): a cache of `@umber-style/cache` for the page under `CacheProvider`, and the CSS
// of its HTML as chunks in the head. Both tiers run these, from `tests/chunks.spec.ts` and
// `dev-tests/chunks.spec.ts`.

const PATH = '/chunks'

/** One check of the page of chunks. */
export interface ChunksScenario {
  /** What it checks. */
  title: string
  /** Makes the requests or drives the page, and asserts. */
  run(page: Page, tools: RegistryTools): Promise<void>
}

/** The classes of the engine that the selectors of `css` name, each once. */
function readRuleClasses(css: string): string[] {
  const names = new Set<string>()
  for (let at = css.indexOf('.umber-'); at !== -1; at = css.indexOf('.umber-', at + 1)) {
    let end = at + 1
    for (let code = css.codePointAt(end) ?? 0; isNameCode(code); code = css.codePointAt(end) ?? 0) {
      end += 1
    }
    names.add(css.slice(at + 1, end))
  }
  return [...names]
}

/** Whether `code` is a character of a class name of the engine: a lowercase letter, a digit, `-` or `_`. */
function isNameCode(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45 || code === 95
}

export const CHUNKS_SCENARIOS: readonly ChunksScenario[] = [
  {
    title: 'the static page is styled with no script, each rule in the head before its markup',
    async run(_page, tools) {
      const html = await fetchHtml(tools, PATH)
      const styles = readSentStyles(html)
      expect(
        styles.map((style) => style.names.split(' ')[0]),
        'the chunks, in order'
      ).toEqual(['umber-global', 'umber'])
      for (const style of styles) expect(style.start).toBeLessThan(html.indexOf('</head>'))
      expect(readSentClasses(html).length).toBeGreaterThan(5)
      expect(findLateClasses(html), 'classes whose rule comes after them').toEqual([])
      const page = await openWithoutScript(tools, PATH)
      expect(await readStyle(page, 'chunks-card', 'background-color')).toBe('rgb(244, 241, 238)')
      expect(await readStyle(page, 'chunks-button', 'background-color')).toBe('rgb(138, 75, 42)')
      expect(await readStyle(page, 'chunks-rise', 'animation-name')).toMatch(/^chunks-rise-/)
      expect(await page.evaluate(() => getComputedStyle(document.body).margin)).toBe('0px')
      await page.context().close()
    },
  },
  {
    title: 'the page holds its own rules only: every class of its CSS is on an element of its HTML',
    async run(_page, tools) {
      const html = await fetchHtml(tools, PATH)
      const css = readSentStyles(html)
        .map((style) => style.css)
        .join('')
      const used = new Set(readSentClasses(html).map(({ name }) => name))
      expect(
        readRuleClasses(css).filter((name) => !used.has(name)),
        'classes with a rule and no element'
      ).toEqual([])
      expect(css).toContain('@keyframes chunks-rise-')
      expect(css).toContain('@layer umber-global{body{margin:0;')
    },
  },
  {
    title: 'hydration prints no warning and writes no rule a second time',
    async run(page, tools) {
      const sent = await openWithoutScript(tools, PATH)
      const before = await readLiveSelectors(sent)
      await sent.context().close()
      expect(findRepeated(before), 'rules repeated in the HTML').toEqual([])
      await page.goto(`http://localhost:${tools.fixture.port}${PATH}`)
      await page.getByTestId('page-chunks').waitFor()
      await waitForHydrated(page)
      await page.waitForLoadState('networkidle')
      const after = await readLiveSelectors(page)
      expect(findRepeated(after), 'rules repeated after hydration').toEqual([])
      expect(countRoots(after), 'live root rules after hydration').toBe(1)
      const live = countEach(after)
      for (const entry of new Set(before)) {
        if (!entry.includes(':where(:root)')) expect(live.get(entry), entry).toBe(1)
      }
      await expect(page.getByTestId('chunks-card')).toHaveCSS(
        'background-color',
        'rgb(244, 241, 238)'
      )
    },
  },
]
