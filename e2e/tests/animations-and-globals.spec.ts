import type { Page } from '@playwright/test'
import { loadPage, navigateInBrowser } from '../helpers/navigation'
import { collectKeyframesAndGlobals, type KeyframesAndGlobals } from '../helpers/rules'
import { scenario, test, expect } from '../helpers/test'

// Scenarios I to L: the animations of the home page (`Spinner` names its animation in the `animation`
// shorthand, `Pulse` in `animationName`) and the global styles of the shell (the base styles, always
// mounted, and the frame, which the frame switch mounts and unmounts).

const LIGHT = {
  background: 'rgb(255, 255, 255)',
  text: 'rgb(31, 26, 23)',
  primary: 'rgb(138, 75, 42)',
}
const DARK = {
  background: 'rgb(16, 17, 20)',
  text: 'rgb(242, 238, 234)',
  primary: 'rgb(224, 160, 122)',
}

type Colors = typeof LIGHT

/** The computed style of <body> and of the app root that the global rules decide. */
function readBody(page: Page) {
  return page.evaluate(() => {
    const body = getComputedStyle(document.body)
    return {
      backgroundColor: body.backgroundColor,
      color: body.color,
      fontFamily: body.fontFamily,
      // 1.5 of 16px, from the rule inside the media query.
      lineHeight: body.lineHeight,
      borderTopWidth: body.borderTopWidth,
      borderTopColor: body.borderTopColor,
      minHeight: getComputedStyle(document.getElementById('app-root') as Element).minHeight,
    }
  })
}

/** What `readBody` shows with the base styles, the frame on or off, under a theme. */
function expectedBody(colors: Colors, isFrameOn: boolean) {
  return {
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: '"Umber Fixture Sans", sans-serif',
    lineHeight: '24px',
    borderTopWidth: isFrameOn ? '4px' : '0px',
    // Without the frame the border has no colour of its own: it is the colour of the text.
    borderTopColor: isFrameOn ? colors.primary : colors.text,
    // 100vh of the 720px viewport.
    minHeight: '720px',
  }
}

/** The computed animation name of the element with `testId`, and the animations the browser runs on it. */
function readAnimation(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((element) => ({
    name: getComputedStyle(element).animationName,
    running: element
      .getAnimations()
      .map((animation) => `${(animation as CSSAnimation).animationName} ${animation.playState}`),
  }))
}

/** The rules of the global layer whose text starts with `start`. */
const countStarting = (globals: readonly string[], start: string) =>
  globals.filter((text) => text.startsWith(start)).length

/** Every global rule of the shell once: the base styles, and the frame when it is on. */
function expectGlobalRules({ globals }: KeyframesAndGlobals, isFrameOn: boolean) {
  expect(
    globals.filter((text, index) => globals.indexOf(text) !== index),
    'global rules written twice'
  ).toEqual([])
  expect(countStarting(globals, '@font-face'), 'the two faces of the list').toBe(2)
  expect(countStarting(globals, 'body {'), 'the body rules of the base and the frame').toBe(
    isFrameOn ? 2 : 1
  )
  expect(countStarting(globals, '#app-root {'), 'the rule for an element of the page').toBe(1)
  expect(countStarting(globals, '@media (min-width: 600px)'), 'the media query').toBe(1)
}

/** Both animations of the home page run, each with one `@keyframes` rule of its registered name. */
async function expectAnimations(page: Page, rules: KeyframesAndGlobals) {
  for (const [testId, label] of [
    ['spinner', 'spin'],
    ['pulse', 'pulse'],
  ]) {
    const { name, running } = await readAnimation(page, testId)
    expect(name, `the animation of ${testId}`).toMatch(new RegExp(`^${label}-[0-9a-z]+$`))
    expect(running, `the animations that run on ${testId}`).toEqual([`${name} running`])
    expect(
      rules.keyframes.filter((found) => found === name),
      `@keyframes ${name}`
    ).toHaveLength(1)
  }
}

test('I: the first HTML holds the global rules and the @keyframes rules, with scripting disabled', async ({
  browser,
  fixture,
}, info) => {
  scenario('I', fixture, info)
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: `http://localhost:${fixture.port}`,
  })
  const page = await context.newPage()
  await page.goto(fixture.routes.home)
  await page.getByTestId('page-home').waitFor()
  const rules = await collectKeyframesAndGlobals(page)
  expectGlobalRules(rules, true)
  expect(await readBody(page)).toEqual(expectedBody(LIGHT, true))
  await expectAnimations(page, rules)
  await context.close()
})

test('J: after hydration and a round trip through the pages, each rule is there once', async ({
  page,
  fixture,
}, info) => {
  scenario('J', fixture, info)
  await loadPage(page, fixture, 'home')
  let rules = await collectKeyframesAndGlobals(page)
  expectGlobalRules(rules, true)
  expect(await readBody(page)).toEqual(expectedBody(LIGHT, true))
  await expectAnimations(page, rules)

  for (const name of ['catalog', 'settings', 'home'] as const) {
    await navigateInBrowser(page, name)
    rules = await collectKeyframesAndGlobals(page)
    expectGlobalRules(rules, true)
    expect(await readBody(page), `the body on ${name}`).toEqual(expectedBody(LIGHT, true))
    expect(
      rules.keyframes.filter((found, index) => rules.keyframes.indexOf(found) !== index),
      `@keyframes rules written twice on ${name}`
    ).toEqual([])
  }
  await expectAnimations(page, rules)
})

test('K: the global rules of a Global are removed when it unmounts, and written again when it mounts', async ({
  page,
  fixture,
}, info) => {
  scenario('K', fixture, info)
  await loadPage(page, fixture, 'home')
  expect(await readBody(page)).toEqual(expectedBody(LIGHT, true))

  await page.getByTestId('frame-switch').click()
  await expect.poll(() => readBody(page), 'the frame is gone').toEqual(expectedBody(LIGHT, false))
  const off = await collectKeyframesAndGlobals(page)
  expectGlobalRules(off, false)
  expect(
    off.globals.filter((text) => text.includes('border-top')),
    'the frame rule'
  ).toEqual([])

  await page.getByTestId('frame-switch').click()
  await expect.poll(() => readBody(page), 'the frame is back').toEqual(expectedBody(LIGHT, true))
  expectGlobalRules(await collectKeyframesAndGlobals(page), true)
})

test('L: a global rule that reads a token follows a theme switch, with no reload', async ({
  page,
  fixture,
}, info) => {
  scenario('L', fixture, info)
  await loadPage(page, fixture, 'home')
  await page.evaluate(() => {
    ;(window as unknown as { __stayed: boolean }).__stayed = true
  })
  expect(await readBody(page)).toEqual(expectedBody(LIGHT, true))

  await page.getByTestId('theme-switch').click()
  await expect(page.locator('html')).toHaveClass(/scheme-dark/)
  await expect.poll(() => readBody(page), 'the body in dark').toEqual(expectedBody(DARK, true))

  await page.getByTestId('theme-switch').click()
  await expect(page.locator('html')).toHaveClass(/scheme-light/)
  await expect.poll(() => readBody(page), 'the body in light').toEqual(expectedBody(LIGHT, true))
  const stayed = await page.evaluate(() => (window as unknown as { __stayed?: boolean }).__stayed)
  expect(stayed, 'the page did not reload').toBe(true)
  expectGlobalRules(await collectKeyframesAndGlobals(page), true)
})
