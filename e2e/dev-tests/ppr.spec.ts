import { PPR_SCENARIOS } from '../helpers/ppr'
import { test } from '../helpers/dev'

// Partial prerendering, on the development server of the fixture next-ppr (see helpers/ppr.ts): the
// scenarios that apply to a server that prerenders nothing. Only that fixture has these routes.
for (const scenario of PPR_SCENARIOS.filter(({ tiers }) => tiers.includes('development'))) {
  test(`ppr ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'next-ppr', 'the routes of partial prerendering are in next-ppr')
    const known = scenario.known?.development
    info.fail(known !== undefined, known)
    await scenario.run(
      page,
      { browser, request, fixture: { ...fixture, port: fixture.devPort as number } },
      'development'
    )
  })
}
