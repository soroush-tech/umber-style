import { expect, type Page } from '@playwright/test'
import {
  DEVELOPMENT_TOOLS,
  expectQuiet,
  openWatched,
  readNonce,
  readStyleNonces,
  type CspTier,
} from './csp'
import { findLateClasses, readSentLayout } from './cspServer'
import { waitForHydrated } from './navigation'
import { openWithoutScript, readStyle, type RegistryTools } from './registry'

// The scenarios of partial prerendering, in the fixture `next-ppr` (`cacheComponents` in its
// next.config.ts): `/ppr` has a static shell, prerendered at build time, and a part that waits for the
// request and streams in at request time; `/ppr/other` is prerendered whole; `StyleRegistry` comes from
// the subpath `umber-style/react/next` of the umbrella. `/ppr-csp` is the same under a strict nonce policy
// (proxy.ts), with the cache design: a cache with the nonce of the request, read inside a `Suspense`
// boundary. Both tiers run them, from `tests/next-ppr.spec.ts` and `dev-tests/ppr.spec.ts`; the
// development server prerenders nothing, so what is about the static shell runs on the production build.

/** One scenario, with the tiers it runs on and, for each, why it fails today when it does. */
export interface PprScenario {
  title: string
  tiers: readonly CspTier[]
  /** Why the scenario fails today on a tier, starting with KNOWN. */
  known?: Partial<Record<CspTier, string>>
  run(page: Page, tools: RegistryTools, tier: CspTier): Promise<void>
}

/** The prefix of the style of the fixture. */
const PREFIX = 'ppr'

/** The computed `padding-left` of each part of `/ppr`, by test id, as the fixture styles them. */
const PADDING = {
  'ppr-shell-card': '16px',
  'ppr-client-chip': '6px',
  'ppr-late-card': '28px',
  'ppr-late-client-chip': '14px',
} as const

/**
 * The classes of the prefix on the elements that are shown (not in a hidden part of the stream) for which
 * no rule of the document names the class.
 */
const readUnstyled = (page: Page) =>
  page.evaluate((prefix) => {
    const selectors: string[] = []
    const collect = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText)
        if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules)
      }
    }
    for (const sheet of document.styleSheets) collect(sheet.cssRules)
    const missing = new Set<string>()
    for (const element of document.querySelectorAll(`[class*="${prefix}-"]`)) {
      if (element.closest('[hidden]') !== null) continue
      for (const name of element.classList) {
        const isNamed = selectors.some((selector) => selector.includes(`.${name}`))
        if (name.startsWith(`${prefix}-`) && !isNamed) missing.add(name)
      }
    }
    return [...missing]
  }, PREFIX)

/** Waits for the part that streams at request time, then for hydration and for the network to rest. */
async function loadComplete(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.getByTestId('ppr-late-card').waitFor()
  await waitForHydrated(page)
  await page.waitForLoadState('networkidle')
}

/** The HTML of `path` as sent, byte for byte, and the headers of the response. */
async function fetchSent(tools: RegistryTools, path: string) {
  const response = await tools.request.get(`http://localhost:${tools.fixture.port}${path}`)
  expect(response.status(), `the status of ${path}`).toBe(200)
  return {
    html: Buffer.from(await response.body()).toString('latin1'),
    headers: response.headers(),
  }
}

export const PPR_SCENARIOS: readonly PprScenario[] = [
  {
    title:
      '(p1) /ppr is partially prerendered: a static shell from the build, the rest at request time; /ppr/other is prerendered whole',
    tiers: ['production'],
    async run(_page, tools) {
      const home = await fetchSent(tools, '/ppr')
      expect(home.headers['x-nextjs-prerender'], 'prerendered').toBe('1')
      expect(home.headers['x-nextjs-postponed'], 'with a part postponed to the request').toBe('1')
      const shell = home.html.indexOf('data-testid="ppr-shell-card"')
      const fallback = home.html.indexOf('data-testid="ppr-fallback"')
      const late = home.html.indexOf('<section data-testid="ppr-late-card"')
      expect(shell, 'the card of the shell').toBeGreaterThan(-1)
      expect(fallback, 'the fallback, after the card').toBeGreaterThan(shell)
      expect(late, 'the late part, after the fallback').toBeGreaterThan(fallback)
      // A page prerendered whole is sent with the header twice (`1, 1`).
      const other = await fetchSent(tools, '/ppr/other')
      expect(other.headers['x-nextjs-prerender']).toMatch(/^1(, 1)*$/)
      expect(other.headers['x-nextjs-postponed']).toBeUndefined()
    },
  },
  {
    title:
      '(p2) first load, JavaScript on: the shell and the part streamed at request time are styled, every class has a rule, nothing is reported',
    tiers: ['production', 'development'],
    async run(page) {
      await loadComplete(page, '/ppr')
      for (const [testId, value] of Object.entries(PADDING)) {
        expect(await readStyle(page, testId, 'padding-left'), testId).toBe(value)
      }
      expect(await readUnstyled(page), 'classes with no rule').toEqual([])
    },
  },
  {
    title:
      '(p3) first load, JavaScript off: the static shell and its fallback are styled; the part streamed stays hidden, as any boundary with no script',
    tiers: ['production', 'development'],
    async run(_page, tools) {
      const page = await openWithoutScript(tools, '/ppr')
      await page.getByTestId('ppr-fallback').waitFor()
      expect(await readStyle(page, 'ppr-shell-card', 'padding-left')).toBe('16px')
      expect(await readStyle(page, 'ppr-client-chip', 'padding-left')).toBe('6px')
      expect(await readStyle(page, 'ppr-fallback', 'padding-left')).toBe('10px')
      expect(await page.getByTestId('ppr-late-card').isVisible(), 'the late part').toBe(false)
      expect(await readUnstyled(page), 'classes with no rule').toEqual([])
      await page.context().close()
    },
  },
  {
    title:
      '(p4) the HTML as sent: the rule of every class of the shell before its first element, the rule of every class of the part streamed in the HTML, the elements of the registry children of the head or the body',
    tiers: ['production', 'development'],
    async run(_page, tools) {
      const { html } = await fetchSent(tools, '/ppr')
      const streamed = html.indexOf('<div hidden id="S:')
      expect(streamed, 'a part streamed after the shell').toBeGreaterThan(-1)
      const { styles, firstUse } = readSentLayout(html, PREFIX)
      const shellUse = new Map([...firstUse].filter(([, start]) => start < streamed))
      expect(shellUse.size, 'classes of the shell').toBeGreaterThan(3)
      expect(
        findLateClasses(styles, shellUse),
        'rules after the first element of the shell'
      ).toEqual([])
      const held = new Set(styles.flatMap(({ hrefs }) => hrefs))
      const unsent = [...firstUse.keys()].filter((name) => !held.has(name))
      expect(unsent, 'classes with no rule in the HTML').toEqual([])
      const registry = [...html.matchAll(/<style[^>]*data-umber-registry[^>]*>/g)]
      expect(registry.length, 'elements of the registry').toBeGreaterThan(0)
      const parents = styles.filter(({ hrefs }) => hrefs.length > 0).map(({ parent }) => parent)
      expect(parents, 'the parent of each style element').toEqual(
        parents.map((parent) => (parent === 'head' ? 'head' : 'body'))
      )
    },
  },
  {
    title:
      '(p5) a client-side navigation to /ppr/other and back: no document load, the classes of each page styled, every class has a rule',
    tiers: ['production', 'development'],
    async run(page) {
      await loadComplete(page, '/ppr')
      await page.evaluate(() => {
        ;(window as unknown as { __hasStayed: boolean }).__hasStayed = true
      })
      await page.getByTestId('link-ppr-other').click()
      await page.getByTestId('page-ppr-other').waitFor()
      await page.waitForLoadState('networkidle')
      expect(await readStyle(page, 'ppr-other-card', 'padding-left')).toBe('24px')
      expect(await readStyle(page, 'ppr-other-card', 'outline-style')).toBe('solid')
      expect(await readUnstyled(page), 'classes with no rule on the other page').toEqual([])
      // The page left stays in the document, hidden by an Activity: the link of the page shown is clicked.
      await page.getByTestId('page-ppr-other').getByTestId('link-ppr-home').click()
      await page.getByTestId('ppr-late-card').waitFor()
      await page.waitForLoadState('networkidle')
      for (const [testId, value] of Object.entries(PADDING)) {
        expect(await readStyle(page, testId, 'padding-left'), `${testId} back home`).toBe(value)
      }
      const hasStayed = await page.evaluate(
        () => (window as unknown as { __hasStayed?: boolean }).__hasStayed
      )
      expect(hasStayed, 'the links made a document load').toBe(true)
    },
  },
  {
    title: '(p6) the HTML as sent holds the rule of each class once',
    tiers: ['production'],
    known: {
      production:
        'KNOWN: under partial prerendering the registry writes the rules of the client components of the static shell at build time, and the render of the request, which renders those components again, writes them again: their rule is in the head twice',
    },
    async run(_page, tools) {
      const { html } = await fetchSent(tools, '/ppr')
      const sent = readSentLayout(html, PREFIX).styles.flatMap(({ hrefs }) => hrefs)
      const repeated = sent.filter((name, index) => sent.indexOf(name) !== index)
      expect(repeated, 'classes sent more than once').toEqual([])
    },
  },
  {
    title:
      '(pc1) under a strict nonce policy: every style element of the engine carries the nonce of the response, and the policy refuses none',
    tiers: ['production', 'development'],
    async run(_page, tools) {
      const { page, reports } = await openWatched(tools)
      const response = await page.goto('/ppr-csp')
      await page.getByTestId('ppr-late-client-chip').waitFor({ state: 'attached' })
      await page.waitForLoadState('networkidle')
      const nonce = readNonce(response?.headers()['content-security-policy'] ?? '')
      const nonces = await readStyleNonces(page, 'style[data-umber], style[data-style]')
      expect(nonces.length, 'style elements of the engine').toBeGreaterThan(0)
      expect(nonces, 'the nonce of each').toEqual(nonces.map(() => nonce))
      const refused = reports.violations.filter(
        ({ text, source }) => text.startsWith('style-src') && !source.includes(DEVELOPMENT_TOOLS)
      )
      expect(refused, 'styles the policy refused').toEqual([])
      expect(await readStyle(page, 'ppr-client-chip', 'padding-left')).toBe('6px')
      expect(await readStyle(page, 'ppr-late-client-chip', 'padding-left')).toBe('14px')
      await page.context().close()
    },
  },
  {
    title:
      '(pc2) under a strict nonce policy the page hydrates and the policy refuses nothing, the scripts of the framework included',
    tiers: ['production', 'development'],
    known: {
      production:
        'KNOWN: the static shell is prerendered at build time, when there is no request and no nonce, so the scripts of the framework in it carry none and the policy refuses them; the page never hydrates. The framework documents partial prerendering as incompatible with a nonce policy (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)',
    },
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      await page.goto('/ppr-csp')
      await page.getByTestId('page-ppr-csp').waitFor({ state: 'attached' })
      await page.waitForLoadState('networkidle')
      expectQuiet(reports, 'on the first load', tier)
      const hydrated = await page.evaluate(() => document.documentElement.dataset.hydrated)
      expect(hydrated, 'the page hydrated').toBe('true')
      await page.context().close()
    },
  },
]
