import { collectComputedStyles } from '../helpers/computedStyles'
import { loadPage, navigateInBrowser } from '../helpers/navigation'
import { findMissingStyles } from '../helpers/rules'
import { scenario, test, expect } from '../helpers/test'

// Scenario H: the theme on <html> is switched by a class, so the engine of the browser did not render a
// provider for it. A token that no page used so far is first used after the navigation; the theme that
// was switched to must have its value.
const DARK_ACCENT = 'rgb(255, 138, 128)'
const LIGHT_ACCENT = 'rgb(179, 38, 30)'

async function expectAccent(page: Parameters<typeof findMissingStyles>[0], color: string) {
  const problems = await findMissingStyles(page)
  expect(
    problems.map((problem) => problem.message),
    'classes with no rule, variables with no value'
  ).toEqual([])
  const styles = await collectComputedStyles(page, '[data-testid="callout"]')
  expect(styles.callout.color, 'the accent colour of the theme').toBe(color)
  expect(styles.callout.borderTopColor, 'the accent colour of the theme').toBe(color)
}

test('H: dark chosen first, then a navigation to a page with a token that is new', async ({
  page,
  fixture,
}, info) => {
  scenario('H', fixture, info)
  await loadPage(page, fixture, 'home')
  await expect(page.locator('html')).toHaveClass(/scheme-light/)
  await page.getByTestId('theme-switch').click()
  await expect(page.locator('html')).toHaveClass(/scheme-dark/)
  await navigateInBrowser(page, 'settings')
  await expectAccent(page, DARK_ACCENT)
})

test('H: the navigation first, then dark, then back to light', async ({ page, fixture }, info) => {
  scenario('H', fixture, info)
  await loadPage(page, fixture, 'home')
  await navigateInBrowser(page, 'settings')
  await expectAccent(page, LIGHT_ACCENT)
  await page.getByTestId('theme-switch').click()
  await expect(page.locator('html')).toHaveClass(/scheme-dark/)
  await expectAccent(page, DARK_ACCENT)
  await page.getByTestId('theme-switch').click()
  await expect(page.locator('html')).toHaveClass(/scheme-light/)
  await expectAccent(page, LIGHT_ACCENT)
})

test('a nested provider keeps its wrapper after a client-side navigation to its page', async ({
  page,
  fixture,
}, info) => {
  info.skip(!fixture.hasClientNavigation, `${fixture.name} has no client-side navigation`)
  await loadPage(page, fixture, 'home')
  await navigateInBrowser(page, 'settings')
  const wrapper = await page
    .getByTestId('brand-card')
    .evaluate((element) => element.closest('.umber-scope')?.className)
  expect(wrapper, 'the wrapper of the brand provider').toMatch(/umber-theme-\w+ umber-boundary/)
  await expect(page.getByTestId('brand-card')).toHaveCSS('background-color', 'rgb(255, 244, 214)')
})
