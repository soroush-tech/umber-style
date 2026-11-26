import { CSP_SERVER_SCENARIOS } from '../helpers/cspServer'
import { test } from '../helpers/dev'

// Server components under a strict content security policy, on the development server of the App Router
// fixture (see helpers/cspServer.ts). Only the App Router fixture has these routes.
for (const scenario of CSP_SERVER_SCENARIOS) {
  test(`policy ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'next-app', 'the policy routes are in the App Router fixture')
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(
      page,
      { browser, request, fixture: { ...fixture, port: fixture.devPort as number } },
      'development'
    )
  })
}
