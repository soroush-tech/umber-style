import { PROVIDER_SCENARIOS } from '../helpers/providers'
import { test } from '../helpers/test'

// The scenarios of theme providers in the App Router fixture, on its production build (see
// helpers/providers.ts). The development tier runs the same ones in dev-tests/providers.spec.ts.
for (const scenario of PROVIDER_SCENARIOS) {
  test(`providers ${scenario.title}`, async ({ page, browser, fixture, watcher }, info) => {
    const known = scenario.knownKey === undefined ? undefined : fixture.known[scenario.knownKey]
    info.fail(known !== undefined, known)
    await scenario.run(page, {
      browser,
      fixture,
      markProblems: () => {
        const at = watcher.problems.length
        return () => {
          watcher.problems.splice(at)
        }
      },
    })
  })
}
