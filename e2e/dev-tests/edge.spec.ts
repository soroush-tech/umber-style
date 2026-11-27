import { EDGE_SCENARIOS } from '../helpers/edge'
import { test } from '../helpers/dev'

// The routes on the edge runtime under a strict content security policy, on the development server of the
// App Router fixture (see helpers/edge.ts). Only the App Router fixture has these routes.
for (const scenario of EDGE_SCENARIOS) {
  test(`edge ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'next-app', 'the edge routes are in the App Router fixture')
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(
      page,
      { browser, request, fixture: { ...fixture, port: fixture.devPort as number } },
      'development'
    )
  })
}
