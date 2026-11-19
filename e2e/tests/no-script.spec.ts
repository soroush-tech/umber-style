import { collectComputedStyles, expectSameStyles } from '../helpers/computedStyles'
import { loadPage, PAGE_NAMES } from '../helpers/navigation'
import { scenario, test } from '../helpers/test'

// Scenario F: with scripting disabled a prerendered or server rendered page is fully styled.
// `page.evaluate` still runs in a context without script: the browser is driven through the protocol.
for (const name of PAGE_NAMES) {
  test(`F: ${name} is fully styled with scripting disabled`, async ({
    page,
    browser,
    fixture,
  }, info) => {
    scenario('F', fixture, info, `F:${name}`)
    await loadPage(page, fixture, name)
    const scripted = await collectComputedStyles(page)

    const context = await browser.newContext({
      javaScriptEnabled: false,
      baseURL: `http://localhost:${fixture.port}`,
    })
    const plain = await context.newPage()
    await plain.goto(fixture.routes[name])
    await plain.getByTestId(`page-${name}`).waitFor()
    expectSameStyles(scripted, await collectComputedStyles(plain), `${name} without script`)
    await context.close()
  })
}
