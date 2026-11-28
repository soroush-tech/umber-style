import { SHARED_SCENARIOS } from '../helpers/shared'
import { test } from '../helpers/test'

// One styled component rendered from a server component and from a client component on one page under
// `StyleRegistry`, with the strict policy of /csp-server and with none, on the production build of the
// App Router fixture (see helpers/shared.ts). The development tier runs the same ones in
// dev-tests/shared.spec.ts.
for (const scenario of SHARED_SCENARIOS) {
  test(`shared ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(page, { browser, request, fixture }, 'production')
  })
}
