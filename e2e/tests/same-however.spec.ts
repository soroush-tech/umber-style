import { collectComputedStyles, expectSameStyles } from '../helpers/computedStyles'
import { loadPage, navigateInBrowser, PAGE_NAMES, storeScheme } from '../helpers/navigation'
import { requireScenario, test, expect } from '../helpers/test'

const pairs = PAGE_NAMES.flatMap((target) =>
  PAGE_NAMES.filter((from) => from !== target).map((from) => ({ from, target }))
)

// Scenario B: the same page looks the same however you arrive at it.
for (const { from, target } of pairs) {
  test(`B: ${target} after a direct load equals ${target} after navigating from ${from}`, async ({
    page,
    fixture,
  }, info) => {
    requireScenario('B', fixture, info)
    await loadPage(page, fixture, target)
    const direct = await collectComputedStyles(page)
    expect(Object.keys(direct).length).toBeGreaterThan(10)

    await loadPage(page, fixture, from)
    await navigateInBrowser(page, target)
    expectSameStyles(direct, await collectComputedStyles(page), `${target} via ${from}`)
  })
}

// Scenario C: the same, with the dark scheme chosen before the navigation.
for (const { from, target } of pairs) {
  test(`C: dark ${target} loaded directly equals ${target} reached from ${from} after switching to dark`, async ({
    page,
    browser,
    fixture,
  }, info) => {
    requireScenario('C', fixture, info, `C:${target}:${from}`)
    // Direct: the dark choice was stored by an earlier visit.
    await storeScheme(page, 'dark')
    await loadPage(page, fixture, target)
    await expect(page.locator('html')).toHaveClass(/scheme-dark/)
    const direct = await collectComputedStyles(page)

    // Arriving: a visit with nothing stored (light), the switch of the page, then the link.
    const context = await browser.newContext({ baseURL: `http://localhost:${fixture.port}` })
    const arriving = await context.newPage()
    await loadPage(arriving, fixture, from)
    await expect(arriving.locator('html')).toHaveClass(/scheme-light/)
    await arriving.getByTestId('theme-switch').click()
    await expect(arriving.locator('html')).toHaveClass(/scheme-dark/)
    await navigateInBrowser(arriving, target)
    expectSameStyles(direct, await collectComputedStyles(arriving), `dark ${target} via ${from}`)
    await context.close()
  })
}
