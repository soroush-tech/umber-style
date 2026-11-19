import { collectComputedStyles } from '../helpers/computedStyles'
import { loadPage, navigateInBrowser, writeReport } from '../helpers/navigation'
import { ENGINE_STYLE_SELECTOR, findMissingStyles } from '../helpers/rules'
import { test, expect } from '../helpers/test'

// Checks that only make sense for Next.js with the App Router: server components and client
// components in one page, streaming, and the request's root theme.
test('(i) a server component is styled in the first HTML, with scripting disabled', async ({
  browser,
  fixture,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: `http://localhost:${fixture.port}`,
  })
  const page = await context.newPage()
  await page.goto('/')
  const styles = await collectComputedStyles(page)
  expect(styles['home-card'].backgroundColor).toBe('rgb(244, 241, 238)')
  expect(styles.hero.backgroundColor).toBe('rgb(138, 75, 42)')
  expect(styles['home-primary'].paddingLeft).toBe('16px')
  await context.close()
})

test('(i) a client component is styled in the first HTML, with scripting disabled', async ({
  browser,
  fixture,
}, info) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: `http://localhost:${fixture.port}`,
  })
  const page = await context.newPage()
  await page.goto('/')
  // The switch is a client component (an outline button). A server button of the same variant is on
  // the catalog page, so there the switch is styled by chance: the classes were sent for the server one.
  const styles = await collectComputedStyles(page)
  const observed = {
    'theme-switch': {
      padding: `${styles['theme-switch'].paddingTop} ${styles['theme-switch'].paddingLeft}`,
      color: styles['theme-switch'].color,
    },
    counter: {
      padding: `${styles.counter.paddingTop} ${styles.counter.paddingLeft}`,
      color: styles.counter.color,
    },
  }
  info.annotations.push({ type: 'observed', description: JSON.stringify(observed) })
  writeReport('next-app-client-no-script.json', observed)
  await context.close()
  expect(styles['theme-switch'].paddingLeft, 'the client Button has its padding').toBe('16px')
})

test('(ii) one style entry per class in the head, none repeated, also for Suspense content that streams late', async ({
  page,
}) => {
  await page.goto('/stream')
  await page.getByTestId('late').waitFor()
  await page.waitForLoadState('networkidle')
  const found = await page.evaluate((selector) => {
    const elements = [...document.querySelectorAll<HTMLStyleElement>(selector)].filter((element) =>
      element.hasAttribute('data-precedence')
    )
    const hrefs = elements.flatMap((element) =>
      (element.dataset.href ?? '').split(' ').filter(Boolean)
    )
    const classes = new Set<string>()
    for (const element of document.querySelectorAll(
      '[data-testid="page-stream"], [data-testid="page-stream"] *'
    )) {
      for (const name of element.classList) {
        if (name.startsWith('umber-') && !/^umber-(boundary|scheme-)/.test(name)) classes.add(name)
      }
    }
    return {
      elements: elements.length,
      allInHead: elements.every((element) => element.parentElement?.tagName === 'HEAD'),
      hrefs,
      classes: [...classes],
    }
  }, ENGINE_STYLE_SELECTOR)
  expect(found.allInHead, 'every style element of the engine is in the head').toBe(true)
  expect(new Set(found.hrefs).size, `no class repeated: ${found.hrefs.join(' ')}`).toBe(
    found.hrefs.length
  )
  for (const name of found.classes) {
    expect(found.hrefs, `a style entry for ${name}`).toContain(name)
  }
  expect(found.classes.some((name) => name.startsWith('umber-late-root-'))).toBe(true)
  // The streamed content is complete and styled once it has arrived.
  const late = await collectComputedStyles(page, '[data-testid="late"]')
  expect(late.late.borderTopWidth).toBe('2px')
})

test('(iii) a component has the same class names as a server component and as a client component', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  const server = await page.getByTestId('home-secondary').getAttribute('class')
  const client = await page.getByTestId('counter').getAttribute('class')
  expect(server).toMatch(/umber-button-root-\w+ umber-button-root-\w+/)
  expect(client).toBe(server)
})

test('(iv) a server component reads the root theme of the request', async ({ page }) => {
  await page.goto('/probe')
  // The root layout of this route gives 641px; the base theme of the engine has 600px.
  await expect(page.getByTestId('read-theme')).toHaveText('641px')
})

test('(v) client-side navigation between routes keeps everything styled', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  for (const name of ['catalog', 'settings', 'home'] as const) {
    await navigateInBrowser(page, name)
    const problems = await findMissingStyles(page)
    expect(
      problems.map((problem) => problem.message),
      `${name}: classes with no rule, variables with no value`
    ).toEqual([])
    const styles = await collectComputedStyles(page)
    expect(styles[`page-${name}`].paddingLeft, `${name}: the page frame is styled`).not.toBe('0px')
  }
})
