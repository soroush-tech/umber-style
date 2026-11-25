import { CSP_SERVER_SCENARIOS } from '../helpers/cspServer'
import { test } from '../helpers/test'

// Server components under a strict content security policy, the nonce of each request from the source the
// app registers (see helpers/cspServer.ts), on the production build of the App Router fixture. The
// development tier runs the same ones in dev-tests/csp-server.spec.ts.
for (const scenario of CSP_SERVER_SCENARIOS) {
  test(`policy ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(page, { browser, request, fixture }, 'production')
  })
}
