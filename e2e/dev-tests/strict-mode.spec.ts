import { loadPage, navigateInBrowser, PAGE_NAMES, type PageName } from '../helpers/navigation'
import { collectComputedStyles } from '../helpers/computedStyles'
import { collectEngineRuleCount, findMissingStyles } from '../helpers/rules'
import { countRulesFor, readEngineClasses, expect, findDuplicateRules, test } from '../helpers/dev'

// The fixtures render under React strict mode in development: a render runs twice and a mount effect
// runs, is cleaned up and runs again. None of that may write a rule twice or leave a wrong class.

/** An element of each page, with how many classes of the engine it has: its own, and one for what was given through `style`. */
const KNOWN: Record<PageName, Array<[testId: string, classCount: number]>> = {
  home: [
    ['hero', 1],
    ['home-card', 1],
    ['home-note', 2],
  ],
  catalog: [
    ['grid', 1],
    ['product-one', 1],
  ],
  settings: [
    ['callout', 1],
    ['panel', 1],
    ['brand-card', 1],
  ],
}

test('strict mode: the app renders under React strict mode', async ({ page, fixture }) => {
  await loadPage(page, fixture, 'home')
  // React keeps a fiber on each element it made, and a fiber has a `mode` with a bit for strict mode
  // (8, double render) and one for strict effects (16, double effects) when a StrictMode is above it.
  const mode = await page.getByTestId('app-root').evaluate((element) => {
    const key = Object.keys(element).find((name) => name.startsWith('__reactFiber'))
    return key === undefined
      ? 0
      : (element as unknown as Record<string, { mode: number }>)[key].mode
  })
  expect(mode & 24, 'strict mode and strict effects are on').toBe(24)
})

for (const name of PAGE_NAMES) {
  test(`strict mode: ${name} has one rule for each class, and no rule twice`, async ({
    page,
    fixture,
  }) => {
    await loadPage(page, fixture, name)
    for (const [testId, classCount] of KNOWN[name]) {
      const classes = await readEngineClasses(page, testId)
      expect(classes, `the engine classes of ${testId}`).toHaveLength(classCount)
      expect(new Set(classes).size, 'a class is on the element once').toBe(classes.length)
      for (const className of classes) {
        expect(await countRulesFor(page, className), `rules for ${className}`).toBe(1)
      }
    }
    expect(await findDuplicateRules(page), 'rules that appear twice').toEqual([])
    expect(await findMissingStyles(page), 'classes with no rule, variables with no value').toEqual(
      []
    )
  })
}

test('strict mode: the right class makes the right style', async ({ page, fixture }) => {
  await loadPage(page, fixture, 'home')
  const styles = await collectComputedStyles(page)
  expect(styles.hero.backgroundColor).toBe('rgb(138, 75, 42)')
  expect(styles['home-card'].backgroundColor).toBe('rgb(244, 241, 238)')
  expect(styles['home-primary'].paddingLeft).toBe('16px')
  expect(styles['home-note'].marginTop).toBe('6px')
  expect(await readEngineClasses(page, 'home-primary')).toHaveLength(2)
})

test('strict mode: a round trip through the pages writes no rule that the first visit did not', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  await page.evaluate(() => {
    const record = { calls: 0 }
    ;(window as unknown as { __observed: typeof record }).__observed = record
    const Original = window.MutationObserver
    window.MutationObserver = class extends Original {
      override observe(target: Node, options?: MutationObserverInit) {
        if (target === document.head) record.calls += 1
        super.observe(target, options)
      }
    }
  })
  for (const name of ['catalog', 'settings', 'home'] as const) await navigateInBrowser(page, name)
  const afterFirstVisit = await collectEngineRuleCount(page)
  for (const name of ['catalog', 'settings', 'home'] as const) await navigateInBrowser(page, name)
  expect(await collectEngineRuleCount(page), 'rules after a second round trip').toBe(
    afterFirstVisit
  )
  expect(await findDuplicateRules(page), 'rules that appear twice').toEqual([])
  const watched = await page.evaluate(
    () => (window as unknown as { __observed: { calls: number } }).__observed.calls
  )
  expect(watched, 'a watch on <head> started while the pages were visited').toBe(0)
})
