import { checkEngineClasses } from '../helpers/rules'
import { loadPage, PAGE_NAMES } from '../helpers/navigation'
import { scenario, test, expect } from '../helpers/test'

// Scenario A: a direct load of each page.
for (const name of PAGE_NAMES) {
  test(`A: ${name} loads with no console error, every engine class has a rule, every variable resolves`, async ({
    page,
    fixture,
  }, info) => {
    scenario('A', fixture, info)
    await loadPage(page, fixture, name)
    // The whole document, so that the theme class on <html> is looked at too.
    const findings = await checkEngineClasses(page, 'html')
    expect(findings.checked, 'elements with an engine class').toBeGreaterThan(5)
    expect(findings.withoutRule, 'engine classes with no rule').toEqual([])
    expect(findings.emptyVariables, 'variables with no value').toEqual([])
  })
}
