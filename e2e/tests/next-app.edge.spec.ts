import { EDGE_SCENARIOS } from '../helpers/edge'
import { test } from '../helpers/test'

// The routes of the App Router fixture on the edge runtime, under a strict content security policy (see
// helpers/edge.ts), on its production build. The development tier runs the same ones in
// dev-tests/edge.spec.ts.
for (const scenario of EDGE_SCENARIOS) {
  test(`edge ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(page, { browser, request, fixture }, 'production')
  })
}
