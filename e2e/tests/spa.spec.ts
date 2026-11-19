import { loadPage, storeScheme } from '../helpers/navigation'
import { test, expect } from '../helpers/test'

// Checks for the client-only app: before script runs there is only index.html.
const LIGHT = 'rgb(255, 255, 255)'
const DARK = 'rgb(16, 17, 20)'

test('index.html holds the static background of each scheme and the pre-paint script', async ({
  request,
}) => {
  const html = await (await request.get('/')).text()
  // The build minifies the inline style: compare without whitespace and quotes.
  const flat = html.replace(/\s+/g, '').replace(/["']/g, '')
  expect(flat, 'the static light background').toContain(
    'html[data-scheme=light]{background-color:#'
  )
  expect(flat, 'the static dark background').toContain(
    'html[data-scheme=dark]{background-color:#101114'
  )
  expect(flat, 'the system preference rule').toContain('(prefers-color-scheme:dark)')
  expect(html, 'the pre-paint script reads the stored choice').toContain('localStorage.getItem')
  expect(html, 'the pre-paint script sets the scheme on <html>').toContain('setAttribute')
  // The script is in the head, before the body: it runs before the first paint.
  expect(html.indexOf('localStorage.getItem')).toBeLessThan(html.indexOf('<body'))
  expect(html, 'no style attribute').not.toMatch(/\sstyle=/)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`the page background is right for ${scheme} with scripting disabled`, async ({
    browser,
    fixture,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      colorScheme: scheme,
      baseURL: `http://localhost:${fixture.port}`,
    })
    const page = await context.newPage()
    await page.goto('/')
    const background = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor
    )
    expect(background).toBe(scheme === 'dark' ? DARK : LIGHT)
    await context.close()
  })
}

test('the stored scheme is on <html> before the body exists', async ({ page, fixture }) => {
  await storeScheme(page, 'dark')
  await page.addInitScript(() => {
    const record = { scheme: 'unset' as string | null }
    ;(window as unknown as { __atBody: typeof record }).__atBody = record
    new MutationObserver((_changes, observer) => {
      if (document.body) {
        record.scheme = document.documentElement.getAttribute('data-scheme')
        observer.disconnect()
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await loadPage(page, fixture, 'home')
  const atBody = await page.evaluate(
    () => (window as unknown as { __atBody: { scheme: string | null } }).__atBody.scheme
  )
  expect(atBody).toBe('dark')
  // And the static background was the dark one from the start.
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
  ).toBe(DARK)
})
