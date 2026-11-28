import { expect, type Page } from '@playwright/test'
import { openWatched, readNonce, type CspScenario, type CspTier } from './csp'
import { openNoScript } from './cspServer'
import { waitForHydrated } from './navigation'
import { readStyle } from './registry'

// The scenarios of the entries of a sheet in server components and in client components (#88), on
// `/csp-server/sheets` of the App Router fixture (`app/(csp-server)`), under the strict policy of that
// group: a new nonce for each request, no 'unsafe-inline'. Supported, and styled: a styled server
// component given a handle (`sheet.serverCard`), the slot pattern within the server components and within
// the client components, client components given the handle of the sheet they import and the entry of
// their own `useStyle`, and one whose style the server component chooses with a plain value. Not
// supported, and unstyled: a style passed from a server component to a client component (the entry it
// resolved, an entry of an object sheet, a handle, a class name), whose CSS does not cross; the
// development tier asserts the warning that says so. Both tiers run them, from
// `tests/next-app.sheets.spec.ts` and `dev-tests/sheets.spec.ts`.

const PAGE = '/csp-server/sheets'
const START = '/csp-server/sheets/start'
const TEST_ID = 'page-csp-server-sheets'

/** The left padding of each supported case, the one its sheet gives it. */
const PADDING: Readonly<Record<string, string>> = {
  'sheets-server-handle': '41px',
  'sheets-server-slot-root': '33px',
  'sheets-client-handle': '31px',
  'sheets-client-use-style': '31px',
  'sheets-client-picked': '31px',
  'sheets-client-slot-root': '33px',
}

/** The cases that are not supported: a style passed from a server component to a client component. */
const UNSTYLED = [
  'sheets-crossed-entry',
  'sheets-crossed-object',
  'sheets-crossed-handle',
  'sheets-class-name',
]

/** The parts of the slots, with the left margin each is given, and the primary colour. */
const AVATAR_MARGIN: Readonly<Record<string, string>> = {
  'sheets-server-slot-avatar': '7px',
  'sheets-client-slot-avatar': '7px',
}
const AVATARS = Object.keys(AVATAR_MARGIN)

/** Every case whose class is read. */
const CASES = [...Object.keys(PADDING), ...UNSTYLED, ...AVATARS]

/** The cases that get the class of `sheet.card` of the client: its own handle, `useStyle`, the plain value. */
const CARD_CASES = ['sheets-client-handle', 'sheets-client-use-style', 'sheets-client-picked']

/** The colours of the light theme of the fixtures (fixtures/shared/src/themes.ts), as the browser computes them. */
const RGB = { primary: 'rgb(138, 75, 42)', accent: 'rgb(179, 38, 30)' } as const

/** The end of the development warning of a style that a server component passed to a client component. */
const CROSSED_WARNING =
  'and its CSS cannot cross: import the sheet in the client component, and pass a plain value such as a string to choose the style.'

/** The fix that the warning of a class that no rule names gives. */
const CLASS_NAME_FIX = 'importing its sheet there'

/** React's development message for an object with members of its own given to a client component. */
const PLAIN_OBJECTS = 'Only plain objects can be passed to Client Components from Server Components'

/** The class of every case, in the document. */
const readClasses = (page: Page) =>
  page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => [id, document.querySelector(`[data-testid="${id}"]`)?.className ?? ''])
      ),
    CASES
  )

/** The class of every case in the HTML as the server sent it, before any script. */
function readSentClasses(html: string): Record<string, string> {
  const classes: Record<string, string> = {}
  for (const id of CASES) {
    const tag = new RegExp(`<[^>]*data-testid="${id}"[^>]*>`).exec(html)?.[0] ?? ''
    classes[id] = /\sclass="([^"]*)"/.exec(tag)?.[1] ?? ''
  }
  return classes
}

/** The override class of a case: the class after the component's own. */
const overrideOf = (className: string) => className.split(' ')[1] ?? ''

/** How many style rules of the document's sheets have `.className` as their selector, at any depth. */
const countRules = (page: Page, className: string) =>
  page.evaluate((name) => {
    let count = 0
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === `.${name}`) count++
        if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules)
      }
    }
    for (const sheet of document.styleSheets) visit(sheet.cssRules)
    return count
  }, className)

/** That every supported case has its computed style, the client's handle, `useStyle` and the plain value one class, and what crossed none. */
async function expectStyled(page: Page, where: string): Promise<void> {
  for (const [id, padding] of Object.entries(PADDING)) {
    expect(await readStyle(page, id, 'padding-left'), `the padding of ${id} ${where}`).toBe(padding)
  }
  for (const id of UNSTYLED) {
    expect(await readStyle(page, id, 'padding-left'), `${id} is unstyled ${where}`).toBe('0px')
  }
  expect(await readStyle(page, 'sheets-client-picked', 'border-left-color'), where).toBe(RGB.accent)
  for (const id of AVATARS) {
    expect(await readStyle(page, id, 'margin-left'), `${id} ${where}`).toBe(AVATAR_MARGIN[id])
    expect(await readStyle(page, id, 'color'), `${id} ${where}`).toBe(RGB.primary)
  }
  expect(await readStyle(page, 'sheets-crossed-object', 'outline-style'), where).toBe('none')
  const classes = await readClasses(page)
  const card = overrideOf(classes['sheets-client-handle'])
  expect(card, `the class of the client's handle ${where}`).toMatch(/^cspsrv-/)
  for (const id of CARD_CASES) {
    expect(overrideOf(classes[id]), `the class of ${id} ${where}`).toBe(card)
  }
}

/** That the rule of the class of each styled case is in the document once, and none for what crossed. */
async function expectRulesOnce(page: Page, where: string): Promise<void> {
  const classes = await readClasses(page)
  for (const id of [...Object.keys(PADDING), ...UNSTYLED]) {
    const className = overrideOf(classes[id])
    if (className === '') continue
    const expected = UNSTYLED.includes(id) ? 0 : 1
    expect(await countRules(page, className), `the rules of ${id} (${className}) ${where}`).toBe(
      expected
    )
  }
}

/** The console lines that are expected on a tier: in development the warnings of the engine and of React. */
function isExpected(line: string, tier: CspTier): boolean {
  if (tier === 'production') return false
  return (
    line.includes(CROSSED_WARNING) || line.includes(CLASS_NAME_FIX) || line.includes(PLAIN_OBJECTS)
  )
}

/** No violation of the policy, and no console message but the expected ones (development only). */
function expectQuietSheets(
  reports: { violations: { text: string; source: string }[]; console: string[] },
  where: string,
  tier: CspTier
): void {
  const violations = reports.violations.filter(
    (violation) => tier === 'production' || !violation.source.includes('next-devtools')
  )
  expect(
    violations.map(({ text, source }) => `${text} (${source})`),
    `violations ${where}`
  ).toEqual([])
  const others = reports.console.filter(
    (line) =>
      !isExpected(line, tier) &&
      !(tier === 'development' && line.includes('Content Security Policy'))
  )
  expect(others, `console errors and warnings ${where}`).toEqual([])
}

export const SHEET_SCENARIOS: readonly CspScenario[] = [
  {
    title:
      '(u1) first load: a styled server component given a handle, the slots within each side, client components that import the sheet or get a plain value are styled; a style passed from a server component to a client component is not',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      await page.goto(PAGE)
      await page.getByTestId(TEST_ID).waitFor()
      await waitForHydrated(page)
      await page.waitForLoadState('networkidle')
      await expectStyled(page, 'on the first load')
      await expectRulesOnce(page, 'on the first load')
      expectQuietSheets(reports, 'on the first load', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(u2) the first HTML: every class the server sent is the class after hydration, its rule is in a style element with the nonce of the response; what crossed has none',
    async run(_page, tools, tier) {
      const response = await tools.request.get(`http://localhost:${tools.fixture.port}${PAGE}`)
      const nonce = readNonce(response.headers()['content-security-policy'] ?? '')
      const html = await response.text()
      const sent = readSentClasses(html)
      const styles = [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]
      for (const [, attributes] of styles) {
        expect(attributes, 'a style element of the HTML').toContain(`nonce="${nonce}"`)
      }
      const text = styles.map(([, , css]) => css).join('')
      for (const id of [...Object.keys(PADDING), ...UNSTYLED]) {
        const className = overrideOf(sent[id])
        if (className === '') continue
        const count = text.split(`.${className}{`).length - 1
        expect(count, `the rule of ${id} in the HTML`).toBe(UNSTYLED.includes(id) ? 0 : 1)
      }
      const { page, reports } = await openWatched(tools)
      await page.goto(PAGE)
      await page.getByTestId(TEST_ID).waitFor()
      await waitForHydrated(page)
      await page.waitForLoadState('networkidle')
      const hydrated = await readClasses(page)
      for (const id of Object.keys(sent)) {
        expect(hydrated[id], `the class of ${id} after hydration`).toBe(sent[id])
      }
      expectQuietSheets(reports, 'through hydration', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(u3) first load with JavaScript off: every supported case is styled as with it, what crossed is not',
    async run(_page, tools) {
      const { page, refused } = await openNoScript(tools, PAGE, TEST_ID)
      for (const [id, padding] of Object.entries(PADDING)) {
        expect(
          await readStyle(page, id, 'padding-left'),
          `the padding of ${id} with no script`
        ).toBe(padding)
      }
      for (const id of UNSTYLED) {
        expect(await readStyle(page, id, 'padding-left'), `${id} with no script`).toBe('0px')
      }
      for (const id of AVATARS) {
        expect(await readStyle(page, id, 'margin-left'), id).toBe(AVATAR_MARGIN[id])
      }
      expect(refused, 'refusals of the policy').toEqual([])
      await page.context().close()
    },
  },
  {
    title:
      '(u4) after a client-side navigation to the page: every supported case is styled, each rule is in the document once, what crossed is not styled, nothing is refused',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      await page.goto(START)
      await page.getByTestId('page-csp-server-sheets-start').waitFor()
      await waitForHydrated(page)
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => {
        ;(window as unknown as { __hasStayed: boolean }).__hasStayed = true
      })
      await page.getByTestId('link-csp-server-sheets').click()
      await page.getByTestId(TEST_ID).waitFor()
      await page.waitForLoadState('networkidle')
      const hasStayed = await page.evaluate(
        () => (window as unknown as { __hasStayed?: boolean }).__hasStayed
      )
      expect(hasStayed, 'the link made a document load, not a client-side navigation').toBe(true)
      await expectStyled(page, 'after the navigation')
      await expectRulesOnce(page, 'after the navigation')
      expectQuietSheets(reports, 'after the navigation', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(u5) the development warnings: each style passed from a server component to a client component says its CSS cannot cross, and the class names say to pass the entry; none in production',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      await page.goto(PAGE)
      await page.getByTestId(TEST_ID).waitFor()
      await waitForHydrated(page)
      await page.waitForLoadState('networkidle')
      if (tier === 'production') {
        expect(reports.console, 'console messages in production').toEqual([])
      } else {
        const classes = await readClasses(page)
        const crossed = reports.console.filter((line) => line.includes(CROSSED_WARNING))
        expect(crossed, 'one warning for each style that crossed').toHaveLength(3)
        for (const id of ['sheets-crossed-entry', 'sheets-crossed-object']) {
          const key = `--umber-entry-${overrideOf(classes[id])}`
          expect(crossed, `the warning of ${id}`).toContain(
            `warning: [cspsrv] A style was passed from a server component to a client component (${key}), ${CROSSED_WARNING}`
          )
        }
        expect(crossed.some((line) => line.includes('(--umber-themed-'))).toBe(true)
        // The page check of the browser runs a while after the last rule: the class name, and the class
        // of each entry that crossed, have no rule.
        await expect
          .poll(() => reports.console.filter((line) => line.includes(CLASS_NAME_FIX)).length, {
            timeout: 10_000,
          })
          .toBe(3)
        const fix = reports.console.find((line) => line.includes(CLASS_NAME_FIX)) as string
        expect(fix).toContain(
          'which no rule names: if it is the class of a sheet entry passed as text'
        )
      }
      await page.context().close()
    },
  },
]
