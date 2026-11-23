import type { Page } from '@playwright/test'
import { collectComputedStyles, expectSameStyles } from '../helpers/computedStyles'
import { createPageTestId, navigateInBrowser, waitForHydrated } from '../helpers/navigation'
import { expect, test } from '../helpers/test'

// The Vue fixture under a strict content security policy: its server sends `?csp` pages with
// `style-src 'nonce-<n>'` (no 'unsafe-inline') and a new nonce for each request.

/** Records each violation of the policy that the page reports, before any script of the page runs. */
async function watchViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __violations: string[] }).__violations = seen
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective}: ${event.blockedURI || event.sample}`)
    })
  })
}

/** The violations the page reported so far. */
const readViolations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)

/** The nonce of each style element of the page, as the browser holds it (the attribute is hidden). */
const readStyleNonces = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('style')].map((element) => element.nonce))

/** The computed styles of `name` loaded with no policy, to compare with. */
async function readPlainStyles(page: Page, path: string, name: string) {
  await page.goto(path)
  await page.getByTestId(createPageTestId(name)).waitFor()
  await waitForHydrated(page)
  return collectComputedStyles(page)
}

test('a page sent with a strict style-src policy is styled, hydrates, and lets in the rules of a client-side navigation', async ({
  page,
}) => {
  const plainHome = await readPlainStyles(page, '/', 'home')
  const plainCatalog = await readPlainStyles(page, '/catalog', 'catalog')

  await watchViolations(page)
  const response = await page.goto('/?csp')
  const policy = response?.headers()['content-security-policy'] ?? ''
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1]
  expect(policy).toMatch(/^style-src 'nonce-[^']+'; script-src 'self' 'nonce-[^']+'$/)
  expect(policy).not.toContain('unsafe-inline')
  await page.getByTestId(createPageTestId('home')).waitFor()
  await waitForHydrated(page)

  // The first HTML is styled by its nonce, and hydration kept it so.
  expectSameStyles(await collectComputedStyles(page), plainHome, 'home under the policy')
  const nonces = await readStyleNonces(page)
  expect(nonces.length).toBeGreaterThan(0)
  expect(nonces).toEqual(nonces.map(() => nonce))

  // A client-side navigation brings classes that the first HTML did not hold: the browser's cache
  // writes them, and the policy lets them in.
  await navigateInBrowser(page, 'catalog')
  expectSameStyles(await collectComputedStyles(page), plainCatalog, 'catalog under the policy')
  const after = await readStyleNonces(page)
  expect(after).toEqual(after.map(() => nonce))
  expect(await readViolations(page)).toEqual([])
})

test('a new request gets a new nonce', async ({ page }) => {
  const first = (await page.goto('/?csp'))?.headers()['content-security-policy']
  const second = (await page.goto('/?csp'))?.headers()['content-security-policy']
  expect(first).toBeDefined()
  expect(first).not.toBe(second)
})
