import { CSP_SCENARIOS } from '../helpers/csp'
import { test } from '../helpers/dev'

// The registry under a strict content security policy, on the development server of the App Router
// fixture, where each rule of the browser's cache is a style element of its own (see helpers/csp.ts).
// Only the App Router fixture has these routes.
for (const scenario of CSP_SCENARIOS) {
  test(`policy ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'next-app', 'the policy routes are in the App Router fixture')
    await scenario.run(
      page,
      { browser, request, fixture: { ...fixture, port: fixture.devPort as number } },
      'development'
    )
  })
}
