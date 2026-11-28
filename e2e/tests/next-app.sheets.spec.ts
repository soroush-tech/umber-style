import { SHEET_SCENARIOS } from '../helpers/sheets'
import { test } from '../helpers/test'

// The entries of a sheet in server components and passed to client components, under the strict policy
// of /csp-server, on the production build of the App Router fixture (see helpers/sheets.ts). The
// development tier runs the same ones in dev-tests/sheets.spec.ts.
for (const scenario of SHEET_SCENARIOS) {
  test(`sheets ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(page, { browser, request, fixture }, 'production')
  })
}
