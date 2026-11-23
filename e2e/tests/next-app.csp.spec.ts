import { CSP_SCENARIOS } from '../helpers/csp'
import { test } from '../helpers/test'

// The registry of the App Router fixture under a strict content security policy (see helpers/csp.ts),
// on its production build. The development tier runs the same ones in dev-tests/csp.spec.ts.
for (const scenario of CSP_SCENARIOS) {
  test(`policy ${scenario.title}`, async ({ page, browser, request, fixture }) => {
    await scenario.run(page, { browser, request, fixture }, 'production')
  })
}
