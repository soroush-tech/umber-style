import { collectComputedStyles, expectSameStyles } from '../helpers/computedStyles'
import { loadPage, navigateInBrowser, PAGE_NAMES, storeScheme } from '../helpers/navigation'
import { findMissingStyles } from '../helpers/rules'
import { expect, test } from '../helpers/dev'

// Client-side navigation in development, between every pair of pages.
for (const from of PAGE_NAMES) {
  for (const to of PAGE_NAMES) {
    if (from === to) continue
    test(`navigation: ${from} then ${to} is styled as ${to} loaded directly`, async ({
      page,
      fixture,
    }) => {
      await loadPage(page, fixture, to)
      const direct = await collectComputedStyles(page)
      await loadPage(page, fixture, from)
      await navigateInBrowser(page, to)
      expect(
        await findMissingStyles(page),
        'classes with no rule, variables with no value'
      ).toEqual([])
      expectSameStyles(direct, await collectComputedStyles(page), `${from} to ${to}`)
    })
  }
}

const DARK_ACCENT = 'rgb(255, 138, 128)'
const LIGHT_ACCENT = 'rgb(179, 38, 30)'

test('navigation: the theme that was chosen is the one that the next page shows', async ({
  page,
  fixture,
}) => {
  await storeScheme(page, 'dark')
  await loadPage(page, fixture, 'home')
  await navigateInBrowser(page, 'settings')
  await expect(page.locator('html')).toHaveClass(/scheme-dark/)
  await expect(page.getByTestId('callout')).toHaveCSS('color', DARK_ACCENT)
  await page.getByTestId('theme-switch').click()
  await expect(page.locator('html')).toHaveClass(/scheme-light/)
  await navigateInBrowser(page, 'catalog')
  await navigateInBrowser(page, 'settings')
  await expect(page.locator('html')).toHaveClass(/scheme-light/)
  await expect(page.getByTestId('callout')).toHaveCSS('color', LIGHT_ACCENT)
  expect(await findMissingStyles(page), 'classes with no rule, variables with no value').toEqual([])
})

test('navigation: a nested provider keeps its wrapper after a client-side navigation to its page', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  await navigateInBrowser(page, 'settings')
  const wrapper = await page
    .getByTestId('brand-card')
    .evaluate((element) => element.closest('.umber-scope')?.className)
  expect(wrapper, 'the wrapper of the brand provider').toMatch(/umber-theme-\w+ umber-boundary/)
  await expect(page.getByTestId('brand-card')).toHaveCSS('background-color', 'rgb(255, 244, 214)')
})
