import { expect, type Page } from '@playwright/test'
import { collectComputedStyles, expectSameStyles, type ComputedStyles } from './computedStyles'
import { waitForHydrated } from './navigation'
import { readSentStyles, readStyle, type RegistryTools } from './registry'

// The scenarios of the registry under a strict content security policy, in the App Router fixture
// (`app/(csp)`, `proxy.ts`): a nonce for each request, `style-src 'nonce-<n>'` with no 'unsafe-inline',
// the cache given the nonce, the registry's element given `nonce={cache.nonce}`. Both tiers run them,
// from `tests/next-app.csp.spec.ts` and `dev-tests/csp.spec.ts`.

/** Which server a scenario runs against: the production build, or the development server. */
export type CspTier = 'production' | 'development'

/** One scenario, which the production and the development tiers both run. */
export interface CspScenario {
  /** The letter of the check, and what it checks. */
  title: string
  /** Drives the page or the requests through the scenario and makes its assertions. */
  run(page: Page, tools: RegistryTools, tier: CspTier): Promise<void>
}

/** One `securitypolicyviolation` event of a page. */
interface Violation {
  /** The directive and what was blocked: `style-src-elem: inline`. */
  text: string
  /** The script that made the element or the rule, when the browser says. */
  source: string
}

/** What a page reported while it was watched: the policy's violations and the console's messages. */
interface Reports {
  /** Each violation of the policy. */
  violations: Violation[]
  /** Each console message of the type error or warning, and each uncaught error. */
  console: string[]
}

/**
 * The script of the framework's development tools. On the development server they write style
 * elements of their own, with no nonce, in the head and in the shadow root of `<nextjs-portal>`: the
 * policy refuses them. They are the framework's, not the engine's, and only that tier has them.
 */
const DEVELOPMENT_TOOLS = 'next-devtools'

/** The console message that Chromium writes for each refused style element. */
const REFUSED =
  'error: Applying inline style violates the following Content Security Policy directive'

/** The dark background of the fixtures' dark theme (fixtures/shared/src/themes.ts), as the browser computes it. */
const DARK_BACKGROUND = 'rgb(16, 17, 20)'

/** The routes under the policy, by the test id of their page. */
const PAGES = { home: '/csp', other: '/csp/other', stream: '/csp/stream' } as const

/** A page of its own context, which the policy test watches from before its first script. */
async function openWatched(tools: RegistryTools): Promise<{ page: Page; reports: Reports }> {
  const context = await tools.browser.newContext({
    baseURL: `http://localhost:${tools.fixture.port}`,
  })
  const page = await context.newPage()
  const reports: Reports = { violations: [], console: [] }
  await page.exposeFunction('__reportViolation', (text: string, source: string) =>
    reports.violations.push({ text, source })
  )
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (
        window as unknown as { __reportViolation(text: string, source: string): void }
      ).__reportViolation
      report(`${event.violatedDirective}: ${event.blockedURI || event.sample}`, event.sourceFile)
    })
  })
  page.on('console', (message) => {
    const type = message.type()
    if (type === 'error' || type === 'warning') reports.console.push(`${type}: ${message.text()}`)
  })
  page.on('pageerror', (error) => reports.console.push(`pageerror: ${error.message}`))
  return { page, reports }
}

/** Loads `path`, waits for its page, for hydration and for the network to rest; returns the policy sent. */
async function load(page: Page, path: string, testId: string): Promise<string> {
  const response = await page.goto(path)
  await page.getByTestId(testId).waitFor()
  await waitForHydrated(page)
  await page.waitForLoadState('networkidle')
  return response?.headers()['content-security-policy'] ?? ''
}

/** The nonce that `policy` gives styles. */
function readNonce(policy: string): string {
  const nonce = /style-src 'nonce-([^']+)'/.exec(policy)?.[1]
  expect(nonce, `a style nonce in "${policy}"`).toBeDefined()
  return nonce as string
}

/** The style elements of the engine and of the registry: those of the cache, and the `data-umber` ones. */
const ENGINE_STYLES = 'style[data-style], style[data-umber]'

/**
 * The nonce of each style element of the document that `selector` matches, as the browser holds it (the
 * attribute is hidden).
 */
const readStyleNonces = (page: Page, selector = 'style') =>
  page.evaluate(
    (matching) =>
      [...document.querySelectorAll<HTMLStyleElement>(matching)].map(
        (element) => element.nonce || '(none)'
      ),
    selector
  )

/**
 * Every style element carries `nonce`, and there is at least one. On the development server the ones
 * of the engine and the registry: the framework's development tools add one with no nonce.
 */
async function expectNonces(
  page: Page,
  nonce: string,
  where: string,
  tier: CspTier
): Promise<number> {
  const nonces = await readStyleNonces(page, tier === 'production' ? 'style' : ENGINE_STYLES)
  expect(nonces.length, `style elements ${where}`).toBeGreaterThan(0)
  expect(nonces, `the nonce of every style element ${where}`).toEqual(nonces.map(() => nonce))
  return nonces.length
}

/** The nonce of each style element of the engine with a root rule (`:where(:root)`) that declares the dark background of the fixtures' dark theme. */
const readDarkHolders = (page: Page) =>
  page.evaluate((selector) => {
    const holders: string[] = []
    for (const element of document.querySelectorAll<HTMLStyleElement>(selector)) {
      const rules = element.sheet ? [...element.sheet.cssRules] : []
      const isDarkRoot = (text: string) =>
        text.includes(':where(:root)') && text.includes('#101114')
      if (rules.some((rule) => isDarkRoot(rule.cssText))) {
        holders.push(element.nonce || '(none)')
      }
    }
    return holders
  }, ENGINE_STYLES)

/**
 * The computed styles of the whole body, with every animation held at its start so that two pages
 * compare, and without the scripts and what the framework renders in them (its development tools).
 */
async function readBody(page: Page): Promise<ComputedStyles> {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause()
      animation.currentTime = 0
    }
  })
  const styles = await collectComputedStyles(page, 'body')
  return Object.fromEntries(Object.entries(styles).filter(([key]) => !key.includes('/script[')))
}

/** The styles of `path` with no policy (`?control=no-policy`), after `then` when it is given. */
async function readPlain(
  tools: RegistryTools,
  path: string,
  testId: string,
  then?: (page: Page) => Promise<void>
): Promise<ComputedStyles> {
  const { page } = await openWatched(tools)
  const policy = await load(page, `${path}?control=no-policy`, testId)
  expect(policy, 'the page to compare with has no policy').toBe('')
  if (then) await then(page)
  const styles = await readBody(page)
  await page.context().close()
  return styles
}

/** Moves to `name` with the page's own link, and fails on a document load. */
async function navigate(page: Page, name: 'other' | 'stream', testId: string): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as { __hasStayed: boolean }).__hasStayed = true
  })
  await page.getByTestId(`link-csp-${name}`).click()
  await page.getByTestId(testId).waitFor()
  await page.mouse.move(1, 700)
  await page.waitForLoadState('networkidle')
  const hasStayed = await page.evaluate(
    () => (window as unknown as { __hasStayed?: boolean }).__hasStayed
  )
  expect(hasStayed, 'the link made a document load, not a client-side navigation').toBe(true)
}

/** Gives the outermost provider the dark theme, and waits until the page shows it. */
async function switchTheme(page: Page): Promise<void> {
  await page.getByTestId('csp-theme-switch').click()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(DARK_BACKGROUND)
}

/**
 * No violation and no console message: the policy let everything in, and hydration said nothing. On the
 * development server the refusals of the framework's development tools are told apart by their script,
 * and as many of Chromium's messages about a refused element are left out; any other is a failure.
 */
function expectQuiet(reports: Reports, where: string, tier: CspTier): void {
  const isTools = (violation: Violation) =>
    tier === 'development' && violation.source.includes(DEVELOPMENT_TOOLS)
  const tools = reports.violations.filter(isTools)
  const others = reports.violations.filter((violation) => !isTools(violation))
  expect(
    others.map(({ text, source }) => `${text} (${source})`),
    `violations ${where}`
  ).toEqual([])
  let refusedLeft = tools.length
  const messages = reports.console.filter((line) => {
    if (!line.startsWith(REFUSED) || refusedLeft === 0) return true
    refusedLeft -= 1
    return false
  })
  expect(messages, `console errors and warnings ${where}`).toEqual([])
}

export const CSP_SCENARIOS: readonly CspScenario[] = [
  {
    title:
      '(a) a page rendered at once is styled under the policy, every style element carries the nonce, and nothing is refused',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, PAGES.home, 'page-csp')
      const { page, reports } = await openWatched(tools)
      const policy = await load(page, PAGES.home, 'page-csp')
      expect(policy).toMatch(/^style-src 'nonce-[^']+'; script-src 'self' 'nonce-[^']+'/)
      expect(policy).not.toContain('unsafe-inline')
      const nonce = readNonce(policy)
      expectSameStyles(await readBody(page), plain, 'the page under the policy')
      await expectNonces(page, nonce, 'after hydration', tier)
      expect(await readStyle(page, 'registry-button', 'padding-left')).toBe('16px')
      expectQuiet(reports, 'on the first load', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(b) the HTML as sent: every style element, the registry and React, carries the nonce of its response',
    async run(_page, tools) {
      for (const path of Object.values(PAGES)) {
        const response = await tools.request.get(`http://localhost:${tools.fixture.port}${path}`)
        const nonce = readNonce(response.headers()['content-security-policy'] ?? '')
        const html = await response.text()
        const tags = [...html.matchAll(/<style[^>]*>/g)].map(([tag]) => tag)
        expect(tags.length, `style elements in the HTML of ${path}`).toBeGreaterThan(0)
        for (const tag of tags)
          expect(tag, `a style element of ${path}`).toContain(`nonce="${nonce}"`)
        const registry = readSentStyles(html).filter((style) => style.names.startsWith('umber '))
        expect(registry.length, `style elements of the registry in ${path}`).toBeGreaterThan(0)
      }
    },
  },
  {
    title:
      '(c) a page that streams: the late chunk brings a style element of its own, with the nonce, and it is let in',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, PAGES.stream, 'registry-late')
      const response = await tools.request.get(
        `http://localhost:${tools.fixture.port}${PAGES.stream}`
      )
      const sentNonce = readNonce(response.headers()['content-security-policy'] ?? '')
      const stream = await response.text()
      const registry = readSentStyles(stream).filter((style) => style.names.startsWith('umber '))
      expect(registry.length, 'style elements of the registry in the stream').toBe(2)
      const late = /<style[^>]*>/g
      const lateTags = [...stream.slice(stream.indexOf('</head>')).matchAll(late)].map(([t]) => t)
      expect(lateTags.length, 'a style element after the head').toBeGreaterThan(0)
      for (const tag of lateTags) expect(tag).toContain(`nonce="${sentNonce}"`)

      const { page, reports } = await openWatched(tools)
      const policy = await load(page, PAGES.stream, 'registry-late')
      const nonce = readNonce(policy)
      expectSameStyles(await readBody(page), plain, 'the streamed page under the policy')
      await expectNonces(page, nonce, 'after the late chunk', tier)
      expectQuiet(reports, 'while the page streamed', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(d) a client-side navigation to a page with classes of its own: the rules the browser writes carry the nonce',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, PAGES.other, 'page-csp-other')
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.home, 'page-csp'))
      await navigate(page, 'other', 'page-csp-other')
      expectSameStyles(await readBody(page), plain, 'the page reached by a navigation')
      expect(await readStyle(page, 'registry-glow', 'animation-name')).toContain('registry-glow')
      await expectNonces(page, nonce, 'after the navigation', tier)
      expectQuiet(reports, 'after the navigation', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(e) a theme switch after hydration: the rules of the new theme are let in, in elements that carry the nonce',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, PAGES.home, 'page-csp', switchTheme)
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.home, 'page-csp'))
      expect(
        await readDarkHolders(page),
        'elements with the dark root theme before the switch'
      ).toEqual([])
      await switchTheme(page)
      expectSameStyles(await readBody(page), plain, 'the page after the switch')
      await expectNonces(page, nonce, 'after the switch', tier)
      // The browser's cache wrote the dark theme after hydration: with insertRule into its element in
      // production, as the text of an element of its own in development. Each holder has the nonce.
      const holders = await readDarkHolders(page)
      expect(holders.length, 'elements that hold the dark theme').toBeGreaterThan(0)
      expect(holders).toEqual(holders.map(() => nonce))
      expectQuiet(reports, 'after the switch', tier)
      await page.context().close()
    },
  },
  {
    title: '(f) a second request gets another nonce',
    async run(_page, tools) {
      const url = `http://localhost:${tools.fixture.port}${PAGES.home}`
      const first = (await tools.request.get(url)).headers()['content-security-policy']
      const second = (await tools.request.get(url)).headers()['content-security-policy']
      expect(readNonce(first ?? '')).not.toBe(readNonce(second ?? ''))
    },
  },
  {
    title:
      '(g) the negative control: with the nonce left off the cache the browser refuses the styles and the page is not styled',
    async run(_page, tools) {
      const plain = await readPlain(tools, PAGES.home, 'page-csp')
      const { page, reports } = await openWatched(tools)
      const policy = await load(page, `${PAGES.home}?control=no-cache-nonce`, 'page-csp')
      expect(policy).toContain("style-src 'nonce-")
      const refused = reports.violations.filter(({ source }) => !source.includes(DEVELOPMENT_TOOLS))
      expect(refused.length, 'violations of the policy').toBeGreaterThan(0)
      expect(refused.every(({ text }) => text.startsWith('style-src'))).toBe(true)
      expect(await readStyleNonces(page, ENGINE_STYLES)).toContain('(none)')
      expect(await readStyle(page, 'registry-button', 'padding-left')).not.toBe('16px')
      expect(await readBody(page)).not.toEqual(plain)
      await page.context().close()
    },
  },
]
