import { REGISTRY_SCENARIOS } from '../helpers/registry'
import { test } from '../helpers/test'

// The registry of the providers file that apps copy, in the App Router fixture, on its production
// build (see helpers/registry.ts). The development tier runs the same ones in dev-tests/registry.spec.ts.
for (const scenario of REGISTRY_SCENARIOS) {
  test(`registry ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    const known = scenario.knownKey === undefined ? undefined : fixture.known[scenario.knownKey]
    info.fail(known !== undefined, known)
    await scenario.run(page, { browser, request, fixture })
  })
}
