import { SHEET_SCENARIOS } from '../helpers/sheets'
import { test } from '../helpers/dev'

// The entries of a sheet in server components and passed to client components, under the strict policy
// of /csp-server, on the development server of the App Router fixture (see helpers/sheets.ts). Only the
// App Router fixture has these routes.
for (const scenario of SHEET_SCENARIOS) {
  test(`sheets ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'next-app', 'the sheet routes are in the App Router fixture')
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(
      page,
      { browser, request, fixture: { ...fixture, port: fixture.devPort as number } },
      'development'
    )
  })
}
