import type { Page } from '@playwright/test'
import type { FixtureConfig } from '../fixtures'
import { navigateInBrowser, PAGE_NAMES, pageTestId, waitForHydrated } from '../helpers/navigation'
import {
  expectNoOverride,
  expectOverride,
  findOverrideRules,
  NO_OVERRIDE,
  OVERRIDE,
  readHeader,
  readHeaderShape,
} from '../helpers/pageGlobal'
import { scenario, test, expect } from '../helpers/test'

// Scenario M: a page renders a `Global` whose rule is for the bar of the shell, outside the page (an
// outline in the accent colour). Leaving the page unmounts it: the bar must lose the outline, and no
// style sheet of the document may keep the rule. The App Router fixture renders it three ways, each on
// a route of its own; every other fixture has the first one.

interface Variant {
  /** The page: its route is `/<name>`, its link `link-<name>`, its root `page-<name>`. */
  name: string
  /** What writes the rule. */
  label: string
  /** The one fixture that has the page; every fixture when not given. */
  only?: string
  /** The test id of an element that is there once the page is complete (content that streams late). */
  ready?: string
}

const VARIANTS: readonly Variant[] = [
  { name: 'promo', label: 'the page itself, (a) a client component in the App Router' },
  { name: 'promo-server', label: '(b) a server component', only: 'next-app' },
  {
    name: 'promo-stream',
    label: '(c) a client component that streams late',
    only: 'next-app',
    ready: 'late-promo',
  },
]

const hasVariant = (fixture: FixtureConfig, variant: Variant) =>
  variant.only === undefined || variant.only === fixture.name

/** Waits until the page of `variant` is complete. */
async function waitForVariant(page: Page, variant: Variant): Promise<void> {
  await page.getByTestId(variant.ready ?? pageTestId(variant.name)).waitFor()
}

/** Loads the page of `variant` with a document load, and waits until it is complete and hydrated. */
async function loadVariant(page: Page, variant: Variant): Promise<void> {
  await page.goto(`/${variant.name}`)
  await waitForVariant(page, variant)
  await waitForHydrated(page)
}

for (const variant of VARIANTS) {
  test(`M: ${variant.name}, ${variant.label}: loaded directly and left, its global rule is gone; back, it is there once`, async ({
    page,
    fixture,
  }, info) => {
    info.skip(!hasVariant(fixture, variant), `${fixture.name} has no ${variant.name} page`)
    scenario('M', fixture, info, `M:${variant.name}:left`)
    await loadVariant(page, variant)
    await expectOverride(page, `${variant.name}, loaded directly`)

    await navigateInBrowser(page, 'home')
    await expectNoOverride(page, `home, after ${variant.name}`, info)

    await navigateInBrowser(page, variant.name)
    await waitForVariant(page, variant)
    await expectOverride(page, `${variant.name}, again`)
  })

  test(`M: ${variant.name}, ${variant.label}: reached in the browser and left, its global rule is gone`, async ({
    page,
    fixture,
  }, info) => {
    info.skip(!hasVariant(fixture, variant), `${fixture.name} has no ${variant.name} page`)
    scenario('M', fixture, info, `M:${variant.name}:reached`)
    await page.goto(fixture.routes.home)
    await page.getByTestId(pageTestId('home')).waitFor()
    await waitForHydrated(page)
    // Not asserted here: whether home came with the rule is the subject of the test with no script.
    const { outlineStyle } = await readHeaderShape(page)
    info.annotations.push({ type: 'start', description: `home, loaded directly: ${outlineStyle}` })

    await navigateInBrowser(page, variant.name)
    await waitForVariant(page, variant)
    await expectOverride(page, `${variant.name}, reached from home`)

    await navigateInBrowser(page, 'catalog')
    await expectNoOverride(page, `catalog, after ${variant.name}`, info)
  })

  test(`M: ${variant.name}, ${variant.label}: the rule follows a theme switch`, async ({
    page,
    fixture,
  }, info) => {
    info.skip(!hasVariant(fixture, variant), `${fixture.name} has no ${variant.name} page`)
    scenario('M', fixture, info, `M:${variant.name}:theme`)
    await loadVariant(page, variant)
    await expect.poll(() => readHeader(page), 'the bar in light').toEqual(OVERRIDE.light)
    await page.getByTestId('theme-switch').click()
    await expect(page.locator('html')).toHaveClass(/scheme-dark/)
    await expect.poll(() => readHeader(page), 'the bar in dark').toEqual(OVERRIDE.dark)
  })
}

test('M: with scripting disabled, no page without the rule carries it, after the server rendered the pages with it', async ({
  browser,
  fixture,
}, info) => {
  scenario('M', fixture, info, 'M:no-script')
  info.skip(!fixture.hasHtml, `${fixture.name} sends no HTML of its pages`)
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: `http://localhost:${fixture.port}`,
  })
  const page = await context.newPage()
  // The pages with the rule are rendered first, by the same server and cache as the others. The load
  // event waits for the content that streams late; without script it stays hidden.
  for (const variant of VARIANTS.filter((each) => hasVariant(fixture, each))) {
    await page.goto(`/${variant.name}`)
    await page.getByTestId(pageTestId(variant.name)).waitFor()
  }
  const found: Record<string, unknown> = {}
  for (const name of PAGE_NAMES) {
    await page.goto(fixture.routes[name])
    await page.getByTestId(pageTestId(name)).waitFor()
    found[name] = { header: await readHeaderShape(page), ...(await findOverrideRules(page)) }
  }
  await context.close()
  const clean = { header: NO_OVERRIDE, sheets: [], texts: [] }
  expect(found, 'the pages without the rule').toEqual({
    home: clean,
    catalog: clean,
    settings: clean,
  })
})
