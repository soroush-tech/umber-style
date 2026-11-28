import { expect, type Page } from '@playwright/test'
import { openWatched, readNonce, type CspScenario, type CspTier } from './csp'
import { waitForHydrated } from './navigation'
import { readStyle, type RegistryTools } from './registry'

// The scenarios of one styled component rendered from a server component and from a client component on
// one page under `StyleRegistry` (#91), on `/csp-server/shared` of the App Router fixture
// (`app/(csp-server)`): with the strict policy of that group (a new nonce for each request), and with no
// policy and no nonce (`?control=no-policy`, and the `csp-control` cookie for the requests of a
// navigation). The rule of the card's class is counted in the first HTML, after hydration and after a
// client-side navigation. With a nonce both sides hand it to the registry, which writes it once. With no
// nonce the first HTML holds it twice, as documented: React hoists the server's copy and the registry
// writes the client's, and the browser keeps both. After a navigation the browser's cache, which wrote the
// class for the client component, deletes the copy that the server's payload brings. Both tiers run them,
// from `tests/next-app.shared.spec.ts` and `dev-tests/shared.spec.ts`.

const PAGE = '/csp-server/shared'
const START = '/csp-server/shared/start'
const TEST_ID = 'page-csp-server-shared'
const CARDS = ['shared-server', 'shared-client']

/** The left padding the card's style gives it. */
const PADDING = '23px'

/** The class of the card, the same on both sides, in the HTML as the server sent it. */
function readSentClass(html: string, testId: string): string {
  const tag = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? ''
  return /\sclass="([^"]*)"/.exec(tag)?.[1] ?? ''
}

/** How many style rules of the document's sheets have `.className` as their selector, at any depth. */
const countRules = (page: Page, className: string) =>
  page.evaluate((name) => {
    let count = 0
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === `.${name}`) count++
        if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules)
      }
    }
    for (const sheet of document.styleSheets) visit(sheet.cssRules)
    return count
  }, className)

/** That both cards have the card's padding and one class, which is returned. */
async function expectCards(page: Page, where: string): Promise<string> {
  const classes = await page.evaluate(
    (ids) => ids.map((id) => document.querySelector(`[data-testid="${id}"]`)?.className ?? ''),
    CARDS
  )
  expect(classes[0], `the class of the server card ${where}`).toMatch(/^cspsrv-/)
  expect(classes[1], `the class of the client card ${where}`).toBe(classes[0])
  for (const id of CARDS) {
    expect(await readStyle(page, id, 'padding-left'), `the padding of ${id} ${where}`).toBe(PADDING)
  }
  return classes[0]
}

/** No violation of the policy and no console error or warning, but those of the development tools of the framework. */
function expectQuiet(
  reports: { violations: { text: string; source: string }[]; console: string[] },
  where: string,
  tier: CspTier
): void {
  const violations = reports.violations.filter(
    (violation) => tier === 'production' || !violation.source.includes('next-devtools')
  )
  expect(
    violations.map(({ text, source }) => `${text} (${source})`),
    `violations ${where}`
  ).toEqual([])
  const others = reports.console.filter(
    (line) => !(tier === 'development' && line.includes('Content Security Policy'))
  )
  expect(others, `console errors and warnings ${where}`).toEqual([])
}

/** The first HTML of the page, with or without the policy: the rule of the card's class counted in it, then in the document after hydration. */
async function runFirstLoad(tools: RegistryTools, tier: CspTier, hasPolicy: boolean) {
  const query = hasPolicy ? '' : '?control=no-policy'
  const response = await tools.request.get(`http://localhost:${tools.fixture.port}${PAGE}${query}`)
  const policy = response.headers()['content-security-policy']
  const html = await response.text()
  const className = readSentClass(html, 'shared-server')
  expect(readSentClass(html, 'shared-client'), 'the class of the client card').toBe(className)
  const styles = [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]
  if (hasPolicy) {
    const nonce = readNonce(policy ?? '')
    for (const [, attributes] of styles) {
      expect(attributes, 'a style element of the HTML').toContain(`nonce="${nonce}"`)
    }
  } else {
    expect(policy, 'the policy of the control').toBeUndefined()
  }
  const holders = styles.filter(([, , css]) => css.includes(`.${className}{`))
  const count = holders.reduce((sum, [, , css]) => sum + css.split(`.${className}{`).length - 1, 0)
  // With no nonce React hoists the server's copy and the registry writes the client's (a Limit of
  // docs/nextjs.md); with one both go to the registry.
  expect(count, 'the rule of the card in the first HTML').toBe(hasPolicy ? 1 : 2)
  if (!hasPolicy) {
    expect(
      holders.map(([, attributes]) => attributes.includes('data-precedence="cspsrv"'))
    ).toEqual([true, false])
    expect(holders[1][1]).toContain('data-umber-registry')
  }

  const { page, reports } = await openWatched(tools)
  await page.goto(`${PAGE}${query}`)
  await page.getByTestId(TEST_ID).waitFor()
  await waitForHydrated(page)
  await page.waitForLoadState('networkidle')
  expect(await expectCards(page, 'after hydration')).toBe(className)
  expect(await countRules(page, className), 'the rule of the card after hydration').toBe(
    hasPolicy ? 1 : 2
  )
  expectQuiet(reports, 'through hydration', tier)
  await page.context().close()
}

/** A client-side navigation to the page, with or without the policy: the rule of the card's class counted once. */
async function runNavigation(tools: RegistryTools, tier: CspTier, hasPolicy: boolean) {
  const { page, reports } = await openWatched(tools)
  if (!hasPolicy) {
    await page
      .context()
      .addCookies([
        { name: 'csp-control', value: 'no-policy', url: `http://localhost:${tools.fixture.port}` },
      ])
  }
  await page.goto(START)
  await page.getByTestId(`${TEST_ID}-start`).waitFor()
  await waitForHydrated(page)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => {
    ;(window as unknown as { __hasStayed: boolean }).__hasStayed = true
  })
  await page.getByTestId('link-csp-server-shared').click()
  await page.getByTestId(TEST_ID).waitFor()
  await page.waitForLoadState('networkidle')
  const hasStayed = await page.evaluate(
    () => (window as unknown as { __hasStayed?: boolean }).__hasStayed
  )
  expect(hasStayed, 'the link made a document load, not a client-side navigation').toBe(true)
  const className = await expectCards(page, 'after the navigation')
  // The copy of the server's payload is deleted once the browser's watch of the page has read it.
  await expect
    .poll(() => countRules(page, className), {
      message: 'the rule of the card after the navigation',
    })
    .toBe(1)
  expectQuiet(reports, 'after the navigation', tier)
  await page.context().close()
}

export const SHARED_SCENARIOS: readonly CspScenario[] = [
  {
    title:
      '(y1) a strict policy, first load: the rule of a class rendered by a server and a client component is in the first HTML once, with the nonce, and in the document once after hydration',
    async run(_page, tools, tier) {
      await runFirstLoad(tools, tier, true)
    },
  },
  {
    title:
      '(y2) no policy, first load: the first HTML holds the rule twice, in the element React hoists and in the registry, and the document keeps both after hydration (documented)',
    async run(_page, tools, tier) {
      await runFirstLoad(tools, tier, false)
    },
  },
  {
    title:
      '(y3) a strict policy, after a client-side navigation to the page: the rule of the class is in the document once, and nothing is refused',
    async run(_page, tools, tier) {
      await runNavigation(tools, tier, true)
    },
  },
  {
    title:
      '(y4) no policy, after a client-side navigation to the page: the rule of the class is in the document once',
    async run(_page, tools, tier) {
      await runNavigation(tools, tier, false)
    },
  },
]
