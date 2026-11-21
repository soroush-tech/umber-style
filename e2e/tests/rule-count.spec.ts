import { loadPage, navigateInBrowser, waitForHydrated, writeReport } from '../helpers/navigation'
import { collectEngineRuleCount, countEngineStyleElements } from '../helpers/rules'
import { requireScenario, test, expect } from '../helpers/test'

// Scenario D: after hydration the engine's rule count does not grow until something new renders, and
// going back to a visited page adds nothing.
test('D: the rule count is stable after hydration and does not grow on a visited page', async ({
  page,
  fixture,
}, info) => {
  requireScenario('D', fixture, info)
  await loadPage(page, fixture, 'home')
  const afterHydration = await collectEngineRuleCount(page)
  expect(afterHydration, 'rules after hydration').toBeGreaterThan(0)
  await page.waitForTimeout(500)
  expect(await collectEngineRuleCount(page), 'rules 500 ms after hydration').toBe(afterHydration)

  const counts: Record<string, number> = { load: afterHydration }
  await navigateInBrowser(page, 'catalog')
  counts.catalog = await collectEngineRuleCount(page)
  expect(counts.catalog).toBeGreaterThanOrEqual(afterHydration)
  await navigateInBrowser(page, 'settings')
  counts.settings = await collectEngineRuleCount(page)
  expect(counts.settings).toBeGreaterThanOrEqual(counts.catalog)

  // Back to pages that were visited: nothing is added.
  await navigateInBrowser(page, 'home')
  expect(await collectEngineRuleCount(page), 'rules back on home').toBe(counts.settings)
  await navigateInBrowser(page, 'catalog')
  expect(await collectEngineRuleCount(page), 'rules back on catalog').toBe(counts.settings)

  counts.styleElements = await countEngineStyleElements(page)
  info.annotations.push({ type: 'rule counts', description: JSON.stringify(counts) })
  writeReport(`rule-count-${fixture.name}.json`, counts)
  await waitForHydrated(page)
})
