import { countEngineElements, findMissingStyles } from '../helpers/rules'
import { loadPage, PAGE_NAMES } from '../helpers/navigation'
import { requireScenario, test, expect } from '../helpers/test'

// Scenario A: a direct load of each page.
for (const name of PAGE_NAMES) {
  test(`A: ${name} loads with no console error, every engine class has a rule, every variable resolves`, async ({
    page,
    fixture,
  }, info) => {
    requireScenario('A', fixture, info)
    await loadPage(page, fixture, name)
    // The whole document, so that the theme class on <html> is looked at too.
    expect(await countEngineElements(page), 'elements with an engine class').toBeGreaterThan(5)
    const problems = await findMissingStyles(page)
    expect(
      problems.map((problem) => problem.message),
      'engine classes with no rule, variables with no value'
    ).toEqual([])
  })
}
