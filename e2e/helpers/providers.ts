import { expect, type Browser, type Page } from '@playwright/test'
import type { FixtureConfig } from '../fixtures'
import { navigateInBrowser, waitForHydrated } from './navigation'
import { collectKeyframesAndGlobals, findMissingStyles } from './rules'

// The scenarios of theme providers in the App Router fixture: where each provider's theme goes (on
// `:root`, or on its wrapper), after a full load, a client-side navigation, a refresh that renders
// another root theme, and in the special routes of the framework. Both tiers run them, from
// `tests/next-app-providers.spec.ts` and `dev-tests/providers.spec.ts`.

/** The colours of the themes of the fixture (fixtures/next-app/app/scheme-themes.ts), as the browser computes them. */
export const RGB = {
  rootLightSurface: 'rgb(244, 241, 238)',
  rootDarkSurface: 'rgb(27, 29, 34)',
  rootLightBackground: 'rgb(255, 255, 255)',
  rootDarkBackground: 'rgb(16, 17, 20)',
  baseText: 'rgb(31, 26, 23)',
  brandLightSurface: 'rgb(255, 244, 214)',
  brandDarkSurface: 'rgb(42, 36, 16)',
  brandLightPrimary: 'rgb(42, 111, 138)',
  accentSurface: 'rgb(230, 244, 234)',
  deepSurface: 'rgb(243, 232, 253)',
  onePrimary: 'rgb(106, 27, 154)',
  twoPrimary: 'rgb(173, 20, 87)',
  otherSurface: 'rgb(227, 242, 253)',
  panelSurface: 'rgb(251, 233, 231)',
  lateSurface: 'rgb(255, 253, 231)',
  clientSurface: 'rgb(224, 247, 250)',
} as const

/**
 * What `ThemeProbe` prints (its surface and its primary colour), as a server component and as a client
 * component: the base theme of the shared style, and the themes of the providers above the client one.
 */
export const PROBE = {
  base: '#f4f1ee #8a4b2a',
  brandLight: '#fff4d6 #2a6f8a',
  brandDark: '#2a2410 #7ab8d0',
  deepOne: '#f3e8fd #6a1b9a',
  deepTwo: '#f3e8fd #ad1457',
} as const

/** What a scenario may do besides driving the page: let the console problems that it caused on purpose go. */
export interface ScenarioTools {
  /** Marks the console problems seen so far, and returns what forgets those seen since: the ones that the scenario causes on purpose. */
  markProblems(): () => void
  /** The browser of the test, for a scenario that opens a context of its own. */
  browser: Browser
  /** The fixture app the scenario runs on. */
  fixture: FixtureConfig
}

/** One scenario of the theme providers, which the production and the development tiers both run. */
export interface ProviderScenario {
  /** The number of the scenario in the matrix, and what it checks. */
  title: string
  /** The key of a known failure in `fixture.known`, for a scenario that a real limit makes fail. */
  knownKey?: string
  /** Drives `page` through the scenario and makes its assertions. */
  run(page: Page, tools: ScenarioTools): Promise<void>
}

/** Loads `path` as a document, waits for the page `testId` and for hydration. */
async function load(page: Page, path: string, testId: string): Promise<void> {
  await page.goto(path)
  await page.getByTestId(testId).waitFor()
  await waitForHydrated(page)
}

/** The text of each root rule that the browser applies, from every style sheet of the document. */
export async function readRootRules(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = []
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === ':where(:root)') {
          found.push(rule.cssText)
        } else if (rule instanceof CSSLayerBlockRule) visit(rule.cssRules)
      }
    }
    for (const sheet of document.styleSheets) visit(sheet.cssRules)
    return found
  })
}

/** Exactly one live root rule, and the value of the surface variable on the document root. */
async function expectOneRoot(page: Page, surface: string): Promise<void> {
  await expect.poll(() => readRootRules(page), { message: 'one live root rule' }).toHaveLength(1)
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--umber-palette-surface').trim()
  )
  expect(value, 'the surface of the root theme').toBe(surface)
}

/** No root rule: the theme of the page is a class on <html>. */
async function expectNoRoot(page: Page): Promise<void> {
  expect(await readRootRules(page), 'no root rule').toEqual([])
}

/** How many theme wrappers are above the element `testId`. */
async function countWrappers(page: Page, testId: string): Promise<number> {
  return page.getByTestId(testId).evaluate((element) => {
    let count = 0
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (node.classList.contains('umber-scope')) count += 1
    }
    return count
  })
}

/** The element `testId` has `property` set to `value`, and `wrappers` theme wrappers above it. */
async function expectThemed(
  page: Page,
  testId: string,
  value: string,
  wrappers: number,
  property = 'background-color'
): Promise<void> {
  await expect(page.getByTestId(testId)).toHaveCSS(property, value)
  expect(await countWrappers(page, testId), `the theme wrappers above ${testId}`).toBe(wrappers)
}

/** No class without its rule and no variable without its value. */
async function expectNothingMissing(page: Page): Promise<void> {
  const problems = await findMissingStyles(page)
  expect(
    problems.map((problem) => problem.message),
    'missing styles'
  ).toEqual([])
}

/** The brand page, as it is in the light root theme. */
async function expectBrandPage(page: Page): Promise<void> {
  await expectThemed(page, 's-root-card', RGB.rootLightSurface, 0)
  await expectThemed(page, 's-brand-card', RGB.brandLightSurface, 1)
  await expectThemed(page, 's-sibling-card', RGB.accentSurface, 1)
  await expectThemed(page, 's-equal-card', RGB.rootLightSurface, 1)
  await expectThemed(page, 's-empty-card', RGB.rootLightSurface, 1)
  await expectThemed(page, 's-client-card', RGB.clientSurface, 2)
  await expectThemed(page, 's-slow-in-brand', RGB.brandLightSurface, 1)
  await expectThemed(page, 's-late-card', RGB.lateSurface, 1)
  const [brand, sibling] = await Promise.all(
    ['s-brand-card', 's-sibling-card'].map((testId) =>
      page.getByTestId(testId).evaluate((element) => element.closest('.umber-scope')?.className)
    )
  )
  expect(brand).not.toBe(sibling)
  expect(
    await page
      .getByTestId('s-empty-card')
      .evaluate((element) => element.closest('.umber-scope')?.className)
  ).toBe('umber-theme-0 umber-boundary umber-scope')
  await expectOneRoot(page, '#f4f1ee')
  await expectNothingMissing(page)
}

/** The parts of the brand page that read the theme in other ways. */
async function expectBrandReaders(page: Page): Promise<void> {
  await expect(page.getByTestId('s-global-target')).toHaveCSS(
    'outline-color',
    RGB.brandLightPrimary
  )
  await expect(page.locator('body')).toHaveCSS('background-color', RGB.rootLightBackground)
  await expect(page.getByTestId('s-beat')).toHaveCSS('outline-color', RGB.brandLightPrimary)
  await expect(page.getByTestId('s-when')).toHaveCSS('outline-style', 'dashed')
  await expect(page.getByTestId('s-when')).not.toHaveCSS('text-decoration-line', 'underline')
  await expectProbes(page, PROBE.brandLight)
  await page.getByTestId('s-portal').waitFor()
  await expectThemed(page, 's-portal-scoped', RGB.brandLightSurface, 1)
  await expectThemed(page, 's-portal-bare', RGB.rootLightSurface, 0)
  await expectThemed(page, 's-portal-provided', RGB.accentSurface, 1)
}

/**
 * What reads the theme in JavaScript on the brand page: a client component under the brand provider of
 * the server build shows that theme (`client`); the same component as a server component, and the
 * function theme of a server provider, show the base theme, in every render.
 */
async function expectProbes(page: Page, client: string): Promise<void> {
  await expect(page.getByTestId('s-client-theme')).toHaveText(client)
  await expect(page.getByTestId('s-server-theme')).toHaveText(PROBE.base)
  await expect(page.getByTestId('s-function-card')).toHaveCSS('color', RGB.rootLightSurface)
}

/** How many rules of the global layer hold the rule of the brand page. */
async function countBrandGlobals(page: Page): Promise<number> {
  const { globals } = await collectKeyframesAndGlobals(page)
  return globals.filter((text) => text.includes('s-global-target')).length
}

/** The CSS rules of the document whose selector is exactly `.className`, outside a media query. */
async function countClassRules(page: Page, className: string): Promise<number> {
  return page.evaluate((name) => {
    let count = 0
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === `.${name}`) count += 1
        else if (rule instanceof CSSLayerBlockRule) visit(rule.cssRules)
      }
    }
    for (const sheet of document.styleSheets) visit(sheet.cssRules)
    return count
  }, className)
}

export const PROVIDER_SCENARIOS: readonly ProviderScenario[] = [
  {
    title: 'A1, A18: a static page, isRoot in the layout and a nested provider in the page',
    async run(page) {
      await load(page, '/settings', 'page-settings')
      await expectThemed(page, 'brand-card', RGB.brandLightSurface, 1)
      await expect(page.locator('html')).toHaveClass(/umber-theme-/)
      await expectNoRoot(page)
      await expectNothingMissing(page)
    },
  },
  {
    title: 'A2: a page rendered on each request, its provider nested under the root theme',
    async run(page) {
      await load(page, '/s/brand', 'page-s-brand')
      await expectBrandPage(page)
      await expectBrandReaders(page)
    },
  },
  {
    title: 'A3: a link from a page without a nested provider to one with it, and back, twice',
    async run(page) {
      await load(page, '/', 'page-home')
      for (let round = 0; round < 2; round++) {
        await navigateInBrowser(page, 'settings')
        await expectThemed(page, 'brand-card', RGB.brandLightSurface, 1)
        await expectNoRoot(page)
        await navigateInBrowser(page, 'home')
      }
      await load(page, '/s', 'page-s-home')
      for (let round = 0; round < 2; round++) {
        await navigateInBrowser(page, 's-brand')
        await expectBrandPage(page)
        await navigateInBrowser(page, 's-home')
        await expectThemed(page, 's-home-card', RGB.rootLightSurface, 0)
        await expectOneRoot(page, '#f4f1ee')
      }
    },
  },
  {
    title: 'A4, A5, C17: two pages whose nested providers have other themes, then back and forward',
    async run(page) {
      await load(page, '/s/brand', 'page-s-brand')
      await navigateInBrowser(page, 's-accent')
      const expectAccent = async () => {
        await expectThemed(page, 's-accent-card', RGB.accentSurface, 1)
        await expectThemed(page, 's-server-under-client', RGB.otherSurface, 2)
        await expectOneRoot(page, '#f4f1ee')
        await expectNothingMissing(page)
      }
      await expectAccent()
      await navigateInBrowser(page, 's-brand')
      await expectBrandPage(page)
      await page.goBack()
      await page.getByTestId('page-s-accent').waitFor()
      await expectAccent()
      await page.goBack()
      await page.getByTestId('page-s-brand').waitFor()
      await expectBrandPage(page)
      await expectProbes(page, PROBE.brandLight)
      await page.goForward()
      await page.getByTestId('page-s-accent').waitFor()
      await expectAccent()
    },
  },
  {
    title: 'A6: a link that was prefetched before the click',
    async run(page) {
      await load(page, '/s', 'page-s-home')
      await page.waitForLoadState('networkidle')
      await page.getByTestId('link-s-brand').hover()
      await page.waitForLoadState('networkidle')
      await navigateInBrowser(page, 's-brand')
      await expectBrandPage(page)
    },
  },
  {
    title: 'A7: a hard reload of the nested page, then a navigation away',
    async run(page) {
      await load(page, '/s/brand', 'page-s-brand')
      await page.reload()
      await page.getByTestId('page-s-brand').waitFor()
      await waitForHydrated(page)
      await expectBrandPage(page)
      await navigateInBrowser(page, 's-home')
      await expectThemed(page, 's-home-card', RGB.rootLightSurface, 0)
      await expectOneRoot(page, '#f4f1ee')
    },
  },
  {
    title: 'A8: with scripts disabled, the first HTML of each page has its themes',
    async run(_page, { browser, fixture }) {
      const port = fixture.port
      const context = await browser.newContext({
        javaScriptEnabled: false,
        baseURL: `http://localhost:${port}`,
      })
      try {
        const page = await context.newPage()
        await page.goto('/settings')
        await expectThemed(page, 'brand-card', RGB.brandLightSurface, 1)
        await page.goto('/s/brand')
        await expectThemed(page, 's-root-card', RGB.rootLightSurface, 0)
        await expectThemed(page, 's-brand-card', RGB.brandLightSurface, 1)
        await expectThemed(page, 's-sibling-card', RGB.accentSurface, 1)
        await expectOneRoot(page, '#f4f1ee')
        await page.goto('/s/accent')
        await expectThemed(page, 's-accent-card', RGB.accentSurface, 1)
        await expectThemed(page, 's-server-under-client', RGB.otherSurface, 2)
        await page.goto('/s/deep/one')
        await expectThemed(page, 's-deep-card', RGB.deepSurface, 1)
        await expectThemed(page, 's-one-button', RGB.onePrimary, 2)
        await expectThemed(page, 's-panel-card', RGB.panelSurface, 2)
        await page.goto('/bare')
        await expectThemed(page, 'bare-card', RGB.brandLightSurface, 0)
        await expectOneRoot(page, '#fff4d6')
      } finally {
        await context.close()
      }
    },
  },
  {
    title: 'B9, B11, B12, E28: a refresh renders another root theme and scheme, and back',
    async run(page) {
      await load(page, '/s/brand', 'page-s-brand')
      const lightClass = await page
        .getByTestId('s-brand-card')
        .evaluate((element) => (element.closest('.umber-scope') as Element).classList[0])
      await page.getByTestId('root-switch').click()
      await expect(page.getByTestId('root-switch')).toHaveAttribute('data-scheme', 'dark')
      await expectThemed(page, 's-root-card', RGB.rootDarkSurface, 0)
      await expectThemed(page, 's-brand-card', RGB.brandDarkSurface, 1)
      await expectOneRoot(page, '#1b1d22')
      await expect(page.locator('body')).toHaveCSS('background-color', RGB.rootDarkBackground)
      await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
      const wrapperScheme = await page
        .getByTestId('s-brand-card')
        .evaluate(
          (element) => getComputedStyle(element.closest('.umber-scope') as Element).colorScheme
        )
      expect(wrapperScheme).toBe('dark')
      await expect(page.getByTestId('s-when')).toHaveCSS('text-decoration-line', 'underline')
      await expect(page.getByTestId('s-when')).toHaveCSS('outline-style', 'none')
      // The rule of the light brand theme stays in the element React keeps, and nothing uses it.
      expect(await countClassRules(page, lightClass)).toBe(1)
      expect(await page.locator(`.${lightClass}`).count()).toBe(0)
      await page.getByTestId('root-switch').click()
      await expect(page.getByTestId('root-switch')).toHaveAttribute('data-scheme', 'light')
      await expectBrandPage(page)
      await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
      const rootElements = await page.evaluate(
        () =>
          [...document.querySelectorAll<HTMLStyleElement>('style[data-precedence="umber"]')].filter(
            (element) => element.dataset.href?.includes('umber-root-')
          ).length
      )
      expect(rootElements, 'React kept the element of each root theme').toBeGreaterThanOrEqual(2)
    },
  },
  {
    title:
      'B10: a navigation to another root layout, and between two nested layouts under one root',
    async run(page) {
      await load(page, '/s', 'page-s-home')
      await page.getByTestId('link-bare').click()
      await page.getByTestId('page-bare').waitFor()
      await waitForHydrated(page)
      await expectThemed(page, 'bare-card', RGB.brandLightSurface, 0)
      await expectOneRoot(page, '#fff4d6')
      await page.getByTestId('link-s-home').click()
      await page.getByTestId('page-s-home').waitFor()
      await waitForHydrated(page)
      await expectOneRoot(page, '#f4f1ee')
      await navigateInBrowser(page, 's-one')
      await navigateInBrowser(page, 's-other')
      await expectThemed(page, 's-other-card', RGB.otherSurface, 1)
      await expect(page.getByTestId('s-deep-card')).toHaveCount(0)
      await navigateInBrowser(page, 's-two')
      await expectThemed(page, 's-deep-card', RGB.deepSurface, 1)
      await expectThemed(page, 's-two-button', RGB.twoPrimary, 2)
      await expectOneRoot(page, '#f4f1ee')
    },
  },
  {
    title: 'C13, D24: three levels and a parallel slot, rendered in part by navigations',
    async run(page) {
      const expectDeep = async (name: 'one' | 'two', primary: string) => {
        await expectThemed(page, 's-deep-card', RGB.deepSurface, 1)
        await expectThemed(page, `s-${name}-button`, primary, 2)
        await expectThemed(page, 's-panel-card', RGB.panelSurface, 2)
        await expectOneRoot(page, '#f4f1ee')
        await expectNothingMissing(page)
      }
      await load(page, '/s', 'page-s-home')
      // The nested layout, its slot and the page: the two deepest levels.
      await navigateInBrowser(page, 's-one')
      await expectDeep('one', RGB.onePrimary)
      // The page alone: the deepest level.
      await navigateInBrowser(page, 's-two')
      await expectDeep('two', RGB.twoPrimary)
      await load(page, '/s/deep/two', 'page-s-two')
      await expectDeep('two', RGB.twoPrimary)
    },
  },
  {
    title: 'C16: a page with no provider in its layout: its provider is the outermost one',
    async run(page) {
      await load(page, '/bare', 'page-bare')
      await expectThemed(page, 'bare-card', RGB.brandLightSurface, 0)
      await expect(page.getByTestId('bare-card')).toHaveCSS('color', RGB.baseText)
      await expectOneRoot(page, '#fff4d6')
    },
  },
  {
    title: 'C18, E28: whenScheme at the top, under isRoot and the class on <html>',
    async run(page) {
      await load(page, '/when', 'page-when')
      await expect(page.getByTestId('when-probe')).not.toHaveCSS(
        'text-decoration-line',
        'underline'
      )
      await page.getByTestId('theme-switch').click()
      await expect(page.getByTestId('when-probe')).toHaveCSS('text-decoration-line', 'underline')
    },
  },
  {
    title:
      'C19, E29: a function theme and useTheme() of a server component read the base theme, in a full and in a partial render',
    async run(page) {
      // In a full render the root layout's provider renders in the request; in a partial render the
      // brand provider of the page is the first that renders. Neither changes what they read.
      await load(page, '/s/brand', 'page-s-brand')
      await expectProbes(page, PROBE.brandLight)
      await load(page, '/s', 'page-s-home')
      await navigateInBrowser(page, 's-brand')
      await expectProbes(page, PROBE.brandLight)
    },
  },
  {
    title:
      'C19, E29: useTheme() of a client component under nested providers of the server build, after a full load, navigations, back and forward, and another root theme',
    async run(page) {
      await load(page, '/s/deep/one', 'page-s-one')
      // Two providers of the server build above it: the page's, over the nested layout's.
      await expect(page.getByTestId('s-one-theme')).toHaveText(PROBE.deepOne)
      // The page alone is rendered: its provider merges over the layout's, mounted in the browser.
      await navigateInBrowser(page, 's-two')
      await expect(page.getByTestId('s-two-theme')).toHaveText(PROBE.deepTwo)
      await page.goBack()
      await page.getByTestId('page-s-one').waitFor()
      await expect(page.getByTestId('s-one-theme')).toHaveText(PROBE.deepOne)
      await page.goForward()
      await page.getByTestId('page-s-two').waitFor()
      await expect(page.getByTestId('s-two-theme')).toHaveText(PROBE.deepTwo)
      await navigateInBrowser(page, 's-brand')
      await expectProbes(page, PROBE.brandLight)
      // The root theme changes from the server: the cookie, and a refresh of the server components.
      await page.getByTestId('root-switch').click()
      await expect(page.getByTestId('root-switch')).toHaveAttribute('data-scheme', 'dark')
      await expectProbes(page, PROBE.brandDark)
      await page.getByTestId('root-switch').click()
      await expect(page.getByTestId('root-switch')).toHaveAttribute('data-scheme', 'light')
      await expectProbes(page, PROBE.brandLight)
    },
  },
  {
    title: 'C20: server components and no provider anywhere',
    async run(page) {
      await load(page, '/bare/none', 'page-bare-none')
      const className = await page
        .getByTestId('none-card')
        .evaluate(
          (element) =>
            [...element.classList].find((name) => name.startsWith('umber-card-root-')) ?? ''
        )
      expect(className).not.toBe('')
      expect(await countClassRules(page, className)).toBeGreaterThan(0)
      expect(await readRootRules(page)).toEqual([])
    },
  },
  {
    title:
      'D21, D22: providers inside a boundary that streams late, and a layout that streams late',
    async run(page) {
      await load(page, '/s/stream/late', 'page-s-late')
      await expectThemed(page, 's-late-layout-card', RGB.lateSurface, 1)
      await expectThemed(page, 's-late-button', RGB.onePrimary, 2)
      await expectOneRoot(page, '#f4f1ee')
      await load(page, '/s', 'page-s-home')
      await navigateInBrowser(page, 's-late')
      await expectThemed(page, 's-late-layout-card', RGB.lateSurface, 1)
      await expectThemed(page, 's-late-button', RGB.onePrimary, 2)
      await navigateInBrowser(page, 's-brand')
      await expectThemed(page, 's-late-card', RGB.lateSurface, 1)
      await expectThemed(page, 's-slow-in-brand', RGB.brandLightSurface, 1)
    },
  },
  {
    title: 'D23: the loading, error and not-found states of a nested layout, under its provider',
    async run(page, tools) {
      await load(page, '/s/deep/one', 'page-s-one')
      await page.getByTestId('link-s-slow').click()
      await expectThemed(page, 's-deep-loading', RGB.deepSurface, 1)
      await page.getByTestId('page-s-slow').waitFor()
      await expectOneRoot(page, '#f4f1ee')
      const forget = tools.markProblems()
      await page.getByTestId('link-s-broken').click()
      await expectThemed(page, 's-deep-error', RGB.deepSurface, 1)
      await page.getByTestId('link-s-missing').click()
      await expectThemed(page, 's-deep-not-found', RGB.deepSurface, 1)
      await expectOneRoot(page, '#f4f1ee')
      // The error of the broken page is logged on purpose.
      forget()
    },
  },
  {
    title:
      'D25, E26, E27, E28: portal content, a global rule, keyframes and conditions under a nested provider',
    async run(page) {
      await load(page, '/s/brand', 'page-s-brand')
      await expectBrandReaders(page)
      expect(await countBrandGlobals(page)).toBe(1)
      await navigateInBrowser(page, 's-home')
      await expect.poll(() => countBrandGlobals(page), { message: 'released' }).toBe(0)
      await expect(page.locator('body')).toHaveCSS('background-color', RGB.rootLightBackground)
      await navigateInBrowser(page, 's-brand')
      await expectBrandReaders(page)
      expect(await countBrandGlobals(page)).toBe(1)
    },
  },
]
