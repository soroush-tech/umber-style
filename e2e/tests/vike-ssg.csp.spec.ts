import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from '@playwright/test'
import {
  collectComputedStyles,
  expectSameStyles,
  type ComputedStyles,
} from '../helpers/computedStyles'
import { createPageTestId, navigateInBrowser, waitForHydrated } from '../helpers/navigation'
import { serveStatic, type StaticServer } from '../helpers/staticNonce'
import { expect, test } from '../helpers/test'

// The static build of the Vike fixture under a strict content security policy, served by a host that
// injects a new nonce into each page on the way out (helpers/staticNonce.ts), then continuing as an app
// that moves between pages in the browser. The style of the fixture is given no nonce of its own. In
// production the browser's cache writes the classes the static HTML did not have with `insertRule` into the
// `<style data-style>` element of the static HTML, which carries the injected nonce, and makes no element of
// its own, so these pass with or without the nonce of the page that a cache with none takes (#71).
// Only the production build applies: the development server renders each page on request, it serves no
// static HTML to inject into.

const build = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
  'vike-ssg',
  'dist',
  'client'
)

/** The colours of the light theme of the fixtures (fixtures/shared/src/themes.ts), as the browser computes them. */
const RGB = { primary: 'rgb(138, 75, 42)', accent: 'rgb(179, 38, 30)' } as const

/** What a page under the policy reported: its violations, and Chromium's messages about the policy. */
interface Reports {
  readonly violations: string[]
  readonly refused: string[]
}

/** A page of a new context at `origin`, watched from before its first script. */
async function openWatched(
  browser: Browser,
  origin: string,
  javaScriptEnabled = true
): Promise<{ page: Page; reports: Reports }> {
  const context = await browser.newContext({ baseURL: origin, javaScriptEnabled })
  const page = await context.newPage()
  const reports: Reports = { violations: [], refused: [] }
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) reports.refused.push(message.text())
  })
  await page.exposeFunction('__reportViolation', (text: string) => reports.violations.push(text))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { __reportViolation: (text: string) => void })
        .__reportViolation
      report(`${event.violatedDirective}: ${event.blockedURI || event.sample}`)
    })
  })
  return { page, reports }
}

/** The nonce of each style element of the page, as the browser holds it (the attribute is hidden). */
const readStyleNonces = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('style')].map((element) => element.nonce || '(none)')
  )

/** The nonce that the policy of `response` gives styles. */
function readNonce(policy: string | undefined): string {
  const nonce = /style-src 'nonce-([^']+)'/.exec(policy ?? '')?.[1]
  expect(nonce, `a style nonce in "${policy}"`).toBeDefined()
  return nonce as string
}

/** The computed style `property` of the element `testId`. */
const readStyle = (page: Page, testId: string, property: string) =>
  page
    .getByTestId(testId)
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)

/**
 * The live page loaded, then used as an app: a tone the static HTML did not have, a panel only the
 * browser renders, the theme switched, and a client-side navigation. The styles at each step, by name.
 */
async function walkLivePage(page: Page): Promise<Record<string, ComputedStyles>> {
  const steps: Record<string, ComputedStyles> = {}
  await page.goto('/live')
  await page.getByTestId('page-live').waitFor()
  await waitForHydrated(page)
  steps.loaded = await collectComputedStyles(page)
  await page.getByTestId('live-toggle').click()
  await expect(page.getByTestId('live-toggle')).toHaveText('loud')
  steps.toggled = await collectComputedStyles(page)
  await page.getByTestId('live-open').click()
  await page.getByTestId('live-panel').waitFor()
  steps.opened = await collectComputedStyles(page)
  await page.getByTestId('theme-switch').click()
  await page.mouse.move(1, 700)
  steps.switched = await collectComputedStyles(page)
  await navigateInBrowser(page, 'catalog')
  steps.navigated = await collectComputedStyles(page)
  return steps
}

let server: StaticServer
let plainServer: StaticServer

test.beforeAll(async () => {
  server = await serveStatic(build)
  plainServer = await serveStatic(build, false)
})

test.afterAll(async () => {
  await server.close()
  await plainServer.close()
})

test('a static page with a nonce injected on the way out, JavaScript on: styled as with no policy, every style element with its nonce, nothing refused', async ({
  browser,
  fixture,
}) => {
  const plain = await openWatched(browser, `http://localhost:${fixture.port}`)
  await plain.page.goto('/')
  await plain.page.getByTestId(createPageTestId('home')).waitFor()
  await waitForHydrated(plain.page)
  const plainStyles = await collectComputedStyles(plain.page)
  await plain.page.context().close()

  const { page, reports } = await openWatched(browser, server.origin)
  const response = await page.goto('/')
  const nonce = readNonce(response?.headers()['content-security-policy'])
  await page.getByTestId(createPageTestId('home')).waitFor()
  await waitForHydrated(page)
  expectSameStyles(await collectComputedStyles(page), plainStyles, 'home under the policy')
  const nonces = await readStyleNonces(page)
  expect(nonces.length).toBeGreaterThan(0)
  expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
  expect(reports, 'what the policy refused').toEqual({ violations: [], refused: [] })
  await page.context().close()
})

test('a static page with a nonce injected, continuing as an app: a new tone, a panel only the browser renders, a theme switch and a client-side navigation are styled, the style elements carry the nonce, nothing refused', async ({
  browser,
  fixture,
}) => {
  const plain = await openWatched(browser, `http://localhost:${fixture.port}`)
  const plainSteps = await walkLivePage(plain.page)
  await plain.page.context().close()

  const { page, reports } = await openWatched(browser, server.origin)
  const nonceOf = page.waitForResponse((response) => response.url().endsWith('/live'))
  const steps = await walkLivePage(page)
  const nonce = readNonce((await nonceOf).headers()['content-security-policy'])
  for (const name of Object.keys(plainSteps)) {
    expectSameStyles(steps[name], plainSteps[name], `the live page, ${name}, under the policy`)
  }
  const cacheElements = await page.evaluate(
    () => document.querySelectorAll('style[data-style="umber"]').length
  )
  expect(cacheElements, "the cache's element: the one of the static HTML").toBe(1)
  const nonces = await readStyleNonces(page)
  expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
  expect(reports, 'what the policy refused').toEqual({ violations: [], refused: [] })
  await page.context().close()
})

test('a static page with a nonce injected, JavaScript off: styled as with no policy, nothing refused', async ({
  browser,
  fixture,
}) => {
  const plain = await openWatched(browser, `http://localhost:${fixture.port}`, false)
  await plain.page.goto('/live')
  const plainStyles = await collectComputedStyles(plain.page)
  await plain.page.context().close()
  const { page, reports } = await openWatched(browser, server.origin, false)
  await page.goto('/live')
  expectSameStyles(await collectComputedStyles(page), plainStyles, 'the live page with no script')
  expect(reports.refused, 'what the policy refused').toEqual([])
  await page.context().close()
})

test('the negative control: the same page served with the policy and no nonce injected is refused', async ({
  browser,
}) => {
  const { page, reports } = await openWatched(browser, plainServer.origin, false)
  await page.goto('/live')
  await expect.poll(() => reports.refused.length).toBeGreaterThan(0)
  expect(await readStyle(page, 'live-toggle', 'padding-left'), 'the tone, unstyled').not.toBe(
    '10px'
  )
  await page.context().close()
})

test('the live page has the tone and the panel of the light theme', async ({ browser }) => {
  const { page } = await openWatched(browser, server.origin)
  await page.goto('/live')
  await waitForHydrated(page)
  await page.getByTestId('live-toggle').click()
  await expect(page.getByTestId('live-toggle')).toHaveText('loud')
  expect(await readStyle(page, 'live-toggle', 'padding-left')).toBe('22px')
  expect(await readStyle(page, 'live-toggle', 'color')).toBe(RGB.accent)
  await page.getByTestId('live-open').click()
  expect(await readStyle(page, 'live-panel', 'padding-left')).toBe('18px')
  expect(await readStyle(page, 'live-panel', 'border-left-color')).toBe(RGB.primary)
  await page.context().close()
})
