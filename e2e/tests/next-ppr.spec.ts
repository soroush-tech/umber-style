import { PPR_SCENARIOS } from '../helpers/ppr'
import { test } from '../helpers/test'

// Partial prerendering, on the production build of the fixture next-ppr (see helpers/ppr.ts). The
// development tier runs those that apply there in dev-tests/ppr.spec.ts.
for (const scenario of PPR_SCENARIOS.filter(({ tiers }) => tiers.includes('production'))) {
  test(`ppr ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    const known = scenario.known?.production
    info.fail(known !== undefined, known)
    await scenario.run(page, { browser, request, fixture }, 'production')
  })
}
