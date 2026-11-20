import { loadPage, navigateInBrowser, waitForHydrated } from '../helpers/navigation'
import { expectNoOverride, expectOverride } from '../helpers/pageGlobal'
import { test } from '../helpers/dev'

// Scenario M of the production tier in development, for the promo page (in the App Router fixture, its
// `Global` is in a client component): a global rule for the bar of the shell is gone once the page that
// renders it is left, however the page was reached.

test('page global: the promo page loaded directly and left, its rule is gone; back, it is there once', async ({
  page,
}, info) => {
  await page.goto('/promo')
  await page.getByTestId('page-promo').waitFor()
  await waitForHydrated(page)
  await expectOverride(page, 'promo, loaded directly')

  await navigateInBrowser(page, 'home')
  await expectNoOverride(page, 'home, after promo', info)

  await navigateInBrowser(page, 'promo')
  await expectOverride(page, 'promo, again')
})

test('page global: the promo page reached in the browser and left, its rule is gone', async ({
  page,
  fixture,
}, info) => {
  await loadPage(page, fixture, 'home')
  await navigateInBrowser(page, 'promo')
  await expectOverride(page, 'promo, reached from home')

  await navigateInBrowser(page, 'catalog')
  await expectNoOverride(page, 'catalog, after promo', info)
})
