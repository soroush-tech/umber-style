import type { Page } from '@playwright/test'
import { loadPage } from '../helpers/navigation'
import { collectKeyframesAndGlobals, findMissingStyles } from '../helpers/rules'
import { editSource, engineClasses, expect, SOURCE_FILES, test } from '../helpers/dev'

// A style value is edited in a source file while the server runs. The page must take the new value
// with no document load, and the rule of the old value must not win. Every file is put back after the
// test, whether it passed or not.
const restores: Array<() => void> = []
/** The animation name of the spinner before an edit of its steps, to see it come back. */
let spinBefore: string | undefined
test.afterEach(async ({ page }) => {
  // A server that has just handled one write can miss the next one: the file is written again until
  // the page shows the original values, without a reload. The next test must not meet the edited text.
  try {
    await expect(async () => {
      for (const restore of restores) restore()
      await expect(page.getByTestId('hero')).toHaveCSS('padding-top', '24px', { timeout: 3000 })
      await expect(page.getByTestId('home-note')).toHaveCSS('margin-top', '6px', { timeout: 3000 })
      await expect(page.locator('body')).toHaveCSS('border-top-width', '4px', { timeout: 3000 })
      if (spinBefore !== undefined) {
        await expect(page.getByTestId('spinner')).toHaveCSS('animation-name', spinBefore, {
          timeout: 3000,
        })
      }
    }).toPass()
  } finally {
    for (const restore of restores) restore()
    restores.length = 0
    spinBefore = undefined
  }
})

/** Puts a marker on `window` that a document load would remove, and returns the start time of the document. */
async function markDocument(page: Page): Promise<number> {
  await page.evaluate(() => {
    ;(window as unknown as { __stayed: boolean }).__stayed = true
  })
  return page.evaluate(() => performance.timeOrigin)
}

async function expectNoReload(page: Page, origin: number): Promise<void> {
  const now = await page.evaluate(() => ({
    stayed: (window as unknown as { __stayed?: boolean }).__stayed,
    origin: performance.timeOrigin,
  }))
  expect(now.stayed, 'the marker on window survived: the page did not reload').toBe(true)
  expect(now.origin, 'the document is the one that was loaded').toBe(origin)
}

test('hot replacement: a styled() component takes a new value without a reload', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  const hero = page.getByTestId('hero')
  await expect(hero).toHaveCSS('padding-top', '24px')
  const before = await engineClasses(page, 'hero')
  const origin = await markDocument(page)

  restores.push(editSource(SOURCE_FILES.components, 'padding: theme.space[4],', 'padding: 37,'))

  await expect(hero).toHaveCSS('padding-top', '37px')
  await expect(hero).toHaveCSS('padding-left', '37px')
  const after = await engineClasses(page, 'hero')
  expect(after, 'the class of the old value is gone').not.toContain(before.at(-1))
  expect(after, 'the element has as many classes as before').toHaveLength(before.length)
  await expectNoReload(page, origin)
  expect(await findMissingStyles(page), 'classes with no rule, variables with no value').toEqual([])
})

test('hot replacement: a StyleSheet.create entry takes a new value without a reload', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  const note = page.getByTestId('home-note')
  await expect(note).toHaveCSS('margin-top', '6px')
  const before = await engineClasses(page, 'home-note')
  const origin = await markDocument(page)

  restores.push(editSource(SOURCE_FILES.pages, 'note: { marginTop: 6 }', 'note: { marginTop: 18 }'))

  await expect(note).toHaveCSS('margin-top', '18px')
  const after = await engineClasses(page, 'home-note')
  expect(after, 'the class of the old value is gone').not.toContain(before.at(-1))
  expect(after, 'the element has as many classes as before').toHaveLength(before.length)
  await expectNoReload(page, origin)
  expect(await findMissingStyles(page), 'classes with no rule, variables with no value').toEqual([])
})

/** The text of each `@keyframes` rule named `name` in the page's style sheets. */
async function readKeyframes(page: Page, name: string): Promise<string[]> {
  return page.evaluate((wanted) => {
    const found: string[] = []
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSKeyframesRule && rule.name === wanted) found.push(rule.cssText)
      }
    }
    return found
  }, name)
}

/** The computed animation name of an element. */
const readAnimationName = (element: Element) => getComputedStyle(element).animationName

test('hot replacement: an edited keyframes() gives the animation a new name and its rule', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  const spinner = page.getByTestId('spinner')
  spinBefore = await spinner.evaluate(readAnimationName)
  expect(spinBefore).toMatch(/^spin-[0-9a-z]+$/)
  const origin = await markDocument(page)

  restores.push(
    editSource(
      SOURCE_FILES.components,
      "keyframes({ to: { transform: 'rotate(1turn)' } }",
      "keyframes({ to: { transform: 'rotate(-1turn)' } }"
    )
  )

  await expect
    .poll(() => spinner.evaluate(readAnimationName), 'the new animation name')
    .not.toBe(spinBefore)
  const after = await spinner.evaluate(readAnimationName)
  expect(after).toMatch(/^spin-[0-9a-z]+$/)
  const rules = await readKeyframes(page, after)
  expect(rules, `@keyframes ${after}`).toHaveLength(1)
  expect(rules[0]).toContain('rotate(-1turn)')
  expect(
    await spinner.evaluate((element) =>
      element.getAnimations().map((animation) => (animation as CSSAnimation).animationName)
    ),
    'the animation that runs'
  ).toEqual([after])
  await expectNoReload(page, origin)
  expect(await findMissingStyles(page), 'classes with no rule, variables with no value').toEqual([])
})

test('hot replacement: an edited Global replaces its rule without a reload', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  const body = page.locator('body')
  await expect(body).toHaveCSS('border-top-width', '4px')
  const origin = await markDocument(page)

  restores.push(
    editSource(SOURCE_FILES.components, 'borderTop: `4px solid', 'borderTop: `6px solid')
  )

  await expect(body).toHaveCSS('border-top-width', '6px')
  const { globals } = await collectKeyframesAndGlobals(page)
  const frames = globals.filter((text) => text.startsWith('body {') && text.includes('border-top'))
  expect(frames, 'the rule of the frame, once, with the new value').toHaveLength(1)
  expect(frames[0]).toContain('6px')
  await expectNoReload(page, origin)
  expect(await findMissingStyles(page), 'classes with no rule, variables with no value').toEqual([])
})
