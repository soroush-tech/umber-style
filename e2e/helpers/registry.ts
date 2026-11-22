import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import type { FixtureConfig } from '../fixtures'
import { navigateInBrowser, waitForHydrated } from './navigation'

// The scenarios of the registry in the App Router fixture (`app/(registry)`): the providers file that
// apps copy, a cache of `@umber-style/cache` for each request whose new rules go into the stream with
// `useServerInsertedHTML`. Both tiers run them, from `tests/next-app.registry.spec.ts` and
// `dev-tests/registry.spec.ts`.

/** The style elements of the engine in this set-up: those of the registry, of the browser's caches, of server components. */
const STYLE_SELECTOR =
  'style[data-umber], style[data-style="umber"], style[data-precedence="umber"]'

/** The selector of the root theme: the outermost provider declares its theme there. */
const ROOT_SELECTOR = ':where(:root)'

/** The colours of the light theme of the fixtures (fixtures/shared/src/themes.ts), as the browser computes them. */
const RGB = {
  background: 'rgb(255, 255, 255)',
  surface: 'rgb(244, 241, 238)',
  text: 'rgb(31, 26, 23)',
  primary: 'rgb(138, 75, 42)',
  accent: 'rgb(179, 38, 30)',
  darkBackground: 'rgb(16, 17, 20)',
  darkAccent: 'rgb(255, 138, 128)',
} as const

/** What a scenario needs besides the page. */
export interface RegistryTools {
  /** The browser of the test, for a context of its own (no script, scripts blocked). */
  browser: Browser
  /** Requests that do not go through a page: the HTML as the server sends it. */
  request: APIRequestContext
  /** The fixture app, with the port of the server that the tier runs. */
  fixture: FixtureConfig
}

/** One scenario of the registry, which the production and the development tiers both run. */
export interface RegistryScenario {
  /** The letter of the check, and what it checks. */
  title: string
  /** The key of a known failure in `fixture.known`, for a scenario that the engine does not pass yet. */
  knownKey?: string
  /** Drives the page or the requests through the scenario and makes its assertions. */
  run(page: Page, tools: RegistryTools): Promise<void>
}

/** A style element of the HTML as it was sent: where it starts, its `data-umber`, and its CSS. */
export interface SentStyle {
  start: number
  names: string
  css: string
}

/** A class of the engine on an element of the HTML, at the place of its first use. */
export interface SentClass {
  name: string
  start: number
}

/** The value of the attribute `name` in the text of an opening tag, or `''`. */
function readAttribute(tag: string, name: string): string {
  const marker = ` ${name}="`
  const start = tag.indexOf(marker)
  if (start === -1) return ''
  const from = start + marker.length
  return tag.slice(from, tag.indexOf('"', from))
}

/** Every `<style>` element of `html`, in order. */
export function readSentStyles(html: string): SentStyle[] {
  const styles: SentStyle[] = []
  for (
    let start = html.indexOf('<style');
    start !== -1;
    start = html.indexOf('<style', start + 1)
  ) {
    const open = html.indexOf('>', start)
    const close = html.indexOf('</style>', open)
    const tag = html.slice(start, open)
    styles.push({
      start,
      names: readAttribute(tag, 'data-umber'),
      css: html.slice(open + 1, close),
    })
  }
  return styles
}

/** The first use of each class of the engine in a `class` attribute of `html`. */
export function readSentClasses(html: string): SentClass[] {
  const found = new Map<string, number>()
  const marker = ' class="'
  for (let start = html.indexOf(marker); start !== -1; start = html.indexOf(marker, start + 1)) {
    const from = start + marker.length
    for (const name of html.slice(from, html.indexOf('"', from)).split(' ')) {
      if (name.startsWith('umber-') && !found.has(name)) found.set(name, start)
    }
  }
  return [...found].map(([name, start]) => ({ name, start }))
}

/** Whether `css` has a rule whose selector holds the class `name` (not a longer name that starts with it). */
function hasClassRule(css: string, name: string): boolean {
  const needle = `.${name}`
  for (let at = css.indexOf(needle); at !== -1; at = css.indexOf(needle, at + 1)) {
    const next = css.codePointAt(at + needle.length) ?? 0
    const isNameCharacter =
      (next >= 97 && next <= 122) || (next >= 48 && next <= 57) || next === 45 || next === 95
    if (!isNameCharacter) return true
  }
  return false
}

/** The HTML of `path` as the server sends it, the whole stream. */
export async function fetchHtml(tools: RegistryTools, path: string): Promise<string> {
  const response = await tools.request.get(`http://localhost:${tools.fixture.port}${path}`)
  expect(response.status(), `the status of ${path}`).toBe(200)
  return response.text()
}

/**
 * The classes of `html` whose rule does not arrive before or with the markup that first uses them:
 * no style element that starts before that place holds a rule for the class.
 */
export function findLateClasses(html: string): string[] {
  const styles = readSentStyles(html)
  return readSentClasses(html)
    .filter(({ name, start }) =>
      styles.every((style) => style.start > start || !hasClassRule(style.css, name))
    )
    .map(({ name }) => name)
}

/**
 * The rules of the engine's style elements, once for each rule, as `<groups around it> <selector>`. A
 * theme class and the root theme are written again, by design, each time more of their variables are
 * used (a rule with the added declarations): those are kept by their whole text, so that only the same
 * rule twice counts as twice.
 */
export async function readLiveSelectors(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const found: string[] = []
    const isTheme = (text: string) => text.startsWith('.umber-theme-') || text === ':where(:root)'
    const visit = (list: CSSRuleList, path: string) => {
      for (const rule of list) {
        if (rule instanceof CSSStyleRule) {
          found.push(`${path}${isTheme(rule.selectorText) ? rule.cssText : rule.selectorText}`)
        } else if (rule instanceof CSSKeyframesRule) found.push(`${path}@keyframes ${rule.name}`)
        else if (rule instanceof CSSLayerBlockRule)
          visit(rule.cssRules, `${path}@layer ${rule.name} `)
        else if (rule instanceof CSSMediaRule)
          visit(rule.cssRules, `${path}@media ${rule.conditionText} `)
      }
    }
    for (const element of document.querySelectorAll<HTMLStyleElement>(selector)) {
      if (element.sheet) visit(element.sheet.cssRules, '')
    }
    return found
  }, STYLE_SELECTOR)
}

/** How many times each entry of `list` is in it. */
export function countEach(list: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of list) counts.set(entry, (counts.get(entry) ?? 0) + 1)
  return counts
}

/** The entries of `list` that are in it more than once. */
export function findRepeated(list: readonly string[]): string[] {
  return [...countEach(list)]
    .filter(([, times]) => times > 1)
    .map(([entry, times]) => `${times}x ${entry}`)
}

/** Whether an entry of `readLiveSelectors` is a rule of the root theme. */
const isRoot = (entry: string) => entry.includes(ROOT_SELECTOR)

/** How many live rules declare the root theme. */
export const countRoots = (list: readonly string[]) => list.filter(isRoot).length

/** The classes of the engine on the element `testId` and the elements in it. */
async function readPageClasses(page: Page, testId: string): Promise<string[]> {
  return page.getByTestId(testId).evaluate((root) => {
    const names = new Set<string>()
    for (const element of [root, ...root.querySelectorAll('*')]) {
      for (const name of element.classList) if (name.startsWith('umber-')) names.add(name)
    }
    return [...names]
  })
}

/** A page of a context with scripting disabled, for the HTML as the server sent it. */
export async function openWithoutScript(tools: RegistryTools, path: string): Promise<Page> {
  const context = await tools.browser.newContext({
    javaScriptEnabled: false,
    baseURL: `http://localhost:${tools.fixture.port}`,
  })
  const page = await context.newPage()
  await page.goto(path)
  return page
}

/** Loads `path` in `page`, waits for the page `testId`, for hydration and for the network to rest. */
async function loadHydrated(page: Page, tools: RegistryTools, path: string, testId: string) {
  await page.goto(`http://localhost:${tools.fixture.port}${path}`)
  await page.getByTestId(testId).waitFor()
  await waitForHydrated(page)
  await page.waitForLoadState('networkidle')
}

/** The computed `property` of the element `testId`. */
export const readStyle = (page: Page, testId: string, property: string) =>
  page
    .getByTestId(testId)
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)

export const REGISTRY_SCENARIOS: readonly RegistryScenario[] = [
  {
    title:
      '(a) with scripting disabled the first HTML is styled, each rule before or with its markup, the streamed chunk too',
    async run(_page, tools) {
      for (const path of ['/registry', '/registry/stream', '/registry/other']) {
        const html = await fetchHtml(tools, path)
        expect(readSentClasses(html).length, `classes in ${path}`).toBeGreaterThan(3)
        expect(findLateClasses(html), `classes of ${path} whose rule comes after them`).toEqual([])
      }
      // The late part arrives in a chunk of its own, with its own style element before it.
      const stream = await fetchHtml(tools, '/registry/stream')
      const styles = readSentStyles(stream).filter((style) => style.names.startsWith('umber '))
      expect(styles.length, 'style elements of the registry in the stream').toBe(2)
      const late = readSentClasses(stream).find(({ name }) =>
        name.startsWith('umber-registry-late-root-')
      )
      expect(late, 'the class of the late part').toBeDefined()
      expect(styles[1].names.split(' ')).toContain(late?.name)
      expect(styles[0].names.split(' ')).not.toContain(late?.name)
      expect(styles[1].start).toBeGreaterThan(stream.indexOf('</head>'))
      expect(styles[1].start).toBeLessThan(late?.start ?? 0)

      const page = await openWithoutScript(tools, '/registry')
      expect(await readStyle(page, 'registry-card', 'background-color')).toBe(RGB.surface)
      expect(await readStyle(page, 'registry-button', 'background-color')).toBe(RGB.primary)
      expect(await readStyle(page, 'registry-button', 'padding-left')).toBe('16px')
      await page.context().close()
    },
  },
  {
    title: '(b) the root theme variables and the global rules are in the first flush, in the head',
    async run(_page, tools) {
      const html = await fetchHtml(tools, '/registry/stream')
      const first = readSentStyles(html).find((style) => style.names.startsWith('umber '))
      expect(first, 'a style element of the registry').toBeDefined()
      const { start, names, css } = first as SentStyle
      expect(start, 'the first flush is in the head').toBeLessThan(html.indexOf('</head>'))
      const groups = names.split(' ')
      expect(groups).toContain('umber-layers')
      expect(groups.some((name) => name.startsWith('umber-global-'))).toBe(true)
      expect(groups.some((name) => name.startsWith('umber-root-'))).toBe(true)
      expect(
        css.startsWith('@layer umber-theme,umber-global,umber-components,umber-overrides;')
      ).toBe(true)
      expect(css).toContain('@layer umber-global{*,*::before,*::after{box-sizing:border-box;}}')
      expect(css).toContain(
        '@layer umber-global{body{margin:0;background-color:var(--umber-palette-background);color:var(--umber-palette-text);font-family:sans-serif;}}'
      )
      expect(css).toContain('@layer umber-theme{:where(:root){--umber-palette-background:#ffffff;')
    },
  },
  {
    title: '(c) hydration prints no warning and writes no rule a second time',
    async run(page, tools) {
      for (const [path, testId] of [
        ['/registry', 'registry-card'],
        ['/registry/stream', 'registry-late'],
      ]) {
        const sent = await openWithoutScript(tools, path)
        const before = await readLiveSelectors(sent)
        await sent.context().close()
        // The late part of the stream is in the HTML, hidden until a script moves it: its rules are.
        expect(findRepeated(before), `rules repeated in the HTML of ${path}`).toEqual([])
        await loadHydrated(page, tools, path, testId)
        const after = await readLiveSelectors(page)
        expect(findRepeated(after), `rules repeated after the hydration of ${path}`).toEqual([])
        expect(countRoots(before), `root rules in the HTML of ${path}`).toBeGreaterThan(0)
        const live = countEach(after)
        for (const entry of new Set(before)) {
          if (!isRoot(entry)) expect(live.get(entry), entry).toBe(1)
        }
      }
      expect(await readStyle(page, 'registry-late', 'border-top-style')).toBe('dashed')
      // The browser's cache replaces the root rules of the page with its own, one rule.
      await loadHydrated(page, tools, '/registry', 'registry-card')
      expect(countRoots(await readLiveSelectors(page)), 'live root rules').toBe(1)
    },
  },
  {
    title:
      '(c) a theme switched while the page streams stays when a late chunk arrives with the root rule of the server: one live root rule',
    async run(page, tools) {
      await page.goto(`http://localhost:${tools.fixture.port}/registry/stream`, {
        waitUntil: 'commit',
      })
      await waitForHydrated(page)
      // The user switches the theme while the page is still streaming: the late part has not arrived.
      await expect(page.getByTestId('registry-fallback')).toBeVisible()
      await page.getByTestId('registry-theme-switch').click()
      await expect(page.locator('body')).toHaveCSS('background-color', RGB.darkBackground)
      await expect(page.getByTestId('registry-fallback')).toBeVisible()
      // The late chunk brings the root rule that the server wrote, with the light theme, later in the
      // document than the rule of the browser's cache: the cache removes it as it arrives.
      await page.getByTestId('registry-late').waitFor()
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toHaveCSS('background-color', RGB.darkBackground)
      await expect(page.getByTestId('registry-late')).toHaveCSS('border-top-color', RGB.darkAccent)
      const roots = await page.evaluate((selector) => {
        const found: string[] = []
        for (const element of document.querySelectorAll<HTMLStyleElement>(selector)) {
          for (const rule of element.sheet?.cssRules ?? []) {
            const inner = rule instanceof CSSLayerBlockRule ? [...rule.cssRules] : [rule]
            for (const each of inner) {
              if (each instanceof CSSStyleRule && each.selectorText === ':where(:root)') {
                found.push(
                  `${element.parentElement?.tagName} ${[...element.attributes].map((a) => a.name).join(',')}`
                )
              }
            }
          }
        }
        return found
      }, STYLE_SELECTOR)
      expect(roots, 'the style elements that hold a live root rule').toHaveLength(1)
    },
  },
  {
    title:
      '(d) a client-side navigation adds the rules of the new page only, and keeps those of the old one',
    async run(page, tools) {
      await loadHydrated(page, tools, '/registry', 'page-registry')
      const before = await readLiveSelectors(page)
      const oldClasses = await readPageClasses(page, 'page-registry')
      await navigateInBrowser(page, 'registry-other')
      await expect(page.getByTestId('registry-callout')).toHaveCSS('color', RGB.accent)
      const after = await readLiveSelectors(page)
      const newClasses = await readPageClasses(page, 'page-registry-other')
      const kept = countEach(after)
      for (const entry of before) {
        if (!isRoot(entry)) expect(kept.get(entry), `kept: ${entry}`).toBe(1)
      }
      const previous = new Set(before)
      const added = after.filter(
        (entry) => !previous.has(entry) && !isRoot(entry) && !entry.includes('.umber-theme-')
      )
      const own = newClasses.filter((name) => !oldClasses.includes(name))
      expect(own.length, 'classes that only the new page has').toBeGreaterThan(2)
      for (const entry of added) {
        const isOwn =
          own.some((name) => entry.includes(`.${name}`)) ||
          entry.includes('@keyframes registry-glow-')
        expect(isOwn, `added for the new page: ${entry}`).toBe(true)
      }
      for (const name of own) {
        expect(
          added.some((entry) => entry.includes(`.${name}`)),
          `a rule for ${name}`
        ).toBe(true)
      }
      expect(added.some((entry) => entry.includes('@keyframes registry-glow-'))).toBe(true)
      expect(findRepeated(after), 'rules repeated after the navigation').toEqual([])
      expect(countRoots(after), 'live root rules after the navigation').toBe(1)
      expect(await readStyle(page, 'registry-glow', 'animation-name')).toMatch(/^registry-glow-/)
    },
  },
  {
    title:
      '(e) two requests rendered at the same time keep their rules apart: one cache for each request',
    async run(_page, tools) {
      for (let round = 0; round < 3; round++) {
        const [badge, panel] = await Promise.all([
          fetchHtml(tools, '/registry/pick?kind=badge'),
          fetchHtml(tools, '/registry/pick?kind=panel'),
        ])
        const cssOf = (html: string) =>
          readSentStyles(html)
            .map((style) => style.css)
            .join('')
        expect(badge).toContain('data-testid="pick-badge"')
        expect(panel).toContain('data-testid="pick-panel"')
        expect(cssOf(badge)).toContain('.umber-badge-root-')
        expect(cssOf(badge)).not.toContain('.umber-panel-root-')
        expect(cssOf(panel)).toContain('.umber-panel-root-')
        expect(cssOf(panel)).not.toContain('.umber-badge-root-')
        // Each holds the whole of what it uses: the layers, the global rules and the root theme.
        for (const html of [badge, panel]) {
          expect(cssOf(html)).toContain('@layer umber-theme,umber-global,')
          expect(cssOf(html)).toContain('@layer umber-global{body{margin:0;')
          expect(findLateClasses(html)).toEqual([])
        }
      }
    },
  },
  {
    title:
      '(g) a server component that reads useTheme() of a default style that nothing configured gets an empty object',
    async run(_page, tools) {
      const html = await fetchHtml(tools, '/registry/server-theme')
      expect(html).toContain('<code data-testid="registry-server-theme">{}</code>')
    },
  },
  {
    title: '(f) no unstyled flash: the first paint, scripts blocked, is the styled page',
    async run(_page, tools) {
      const context = await tools.browser.newContext({
        baseURL: `http://localhost:${tools.fixture.port}`,
      })
      await context.route(
        (url) => url.pathname.endsWith('.js'),
        (route) => route.abort()
      )
      const page = await context.newPage()
      await page.goto('/registry', { waitUntil: 'domcontentloaded' })
      expect(await page.evaluate(() => document.documentElement.dataset.hydrated)).toBeUndefined()
      expect(await readStyle(page, 'registry-card', 'background-color')).toBe(RGB.surface)
      expect(await readStyle(page, 'registry-button', 'color')).toBe(RGB.background)
      expect(await page.evaluate(() => getComputedStyle(document.body).margin)).toBe('0px')
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
        RGB.background
      )
      // The late part is moved in by the inline script of the stream, which runs: styled when it shows.
      await page.goto('/registry/stream', { waitUntil: 'domcontentloaded' })
      await page.getByTestId('registry-late').waitFor()
      expect(await readStyle(page, 'registry-late', 'border-top-style')).toBe('dashed')
      expect(await readStyle(page, 'registry-late-badge', 'color')).toBe('rgb(107, 98, 92)')
      await context.close()
    },
  },
]
