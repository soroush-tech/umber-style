import { SHARED_SCENARIOS } from '../helpers/shared'
import { test } from '../helpers/dev'

// One styled component rendered from a server component and from a client component on one page under
// `StyleRegistry`, with the strict policy of /csp-server and with none, on the development server of the
// App Router fixture (see helpers/shared.ts). Only the App Router fixture has these routes.
for (const scenario of SHARED_SCENARIOS) {
  test(`shared ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'next-app', 'the shared routes are in the App Router fixture')
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(
      page,
      { browser, request, fixture: { ...fixture, port: fixture.devPort as number } },
      'development'
    )
  })
}
