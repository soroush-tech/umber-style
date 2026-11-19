import { loadPage, navigateInBrowser, PAGE_NAMES } from '../helpers/navigation'
import { findMissingStyles } from '../helpers/rules'
import { expect, test } from '../helpers/dev'

// The development checker of the engine (`hasDevChecks`, on in development) warns after the rules
// have stopped arriving for a short while. A fake clock that keeps running lets the test move past
// that wait at once instead of sleeping.
const PAST_THE_WAIT = 1000

for (const name of PAGE_NAMES) {
  test(`dev checks: ${name} is healthy, by the page's own checker and by findMissingStyles`, async ({
    page,
    fixture,
    messages,
  }) => {
    await page.clock.install()
    await loadPage(page, fixture, name)
    await page.clock.runFor(PAST_THE_WAIT)
    expect(await findMissingStyles(page), 'classes with no rule, variables with no value').toEqual(
      []
    )
    expect(
      messages.all.filter((line) => line.includes('[umber]')),
      'warnings of the development checker'
    ).toEqual([])
  })
}

test('dev checks: the checker is on, and warns once for a class that no rule names', async ({
  page,
  fixture,
  messages,
}) => {
  await page.clock.install()
  await loadPage(page, fixture, 'home')
  await page.clock.runFor(PAST_THE_WAIT)
  // A class of the engine that nothing defines, outside the app's tree.
  await page.evaluate(() => {
    const element = document.createElement('div')
    element.className = 'umber-never-made'
    element.dataset.testid = 'stray'
    document.body.append(element)
  })
  // New rules arrive with the next page, and the checker looks after them.
  await navigateInBrowser(page, 'catalog')
  await page.clock.runFor(PAST_THE_WAIT)
  await navigateInBrowser(page, 'settings')
  await page.clock.runFor(PAST_THE_WAIT)
  const warnings = messages.all.filter((line) => line.includes('[umber]'))
  expect(warnings, 'one warning for the class, never repeated').toHaveLength(1)
  expect(warnings[0]).toContain('umber-never-made')
  // The warning was expected: take it out of what fails the test.
  messages.all.length = 0
})
