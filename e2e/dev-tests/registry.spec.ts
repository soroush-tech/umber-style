import { REGISTRY_SCENARIOS } from '../helpers/registry'
import { test } from '../helpers/dev'

// The registry of the providers file that apps copy, on the development server of the App Router
// fixture, where React renders twice and runs effects twice (strict mode) and the framework compiles a
// route on its first request (see helpers/registry.ts). Only the App Router fixture has these routes.
for (const scenario of REGISTRY_SCENARIOS) {
  test(`registry ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'next-app', 'the registry routes are in the App Router fixture')
    const known = scenario.knownKey === undefined ? undefined : fixture.known[scenario.knownKey]
    info.fail(known !== undefined, known)
    await scenario.run(page, {
      browser,
      request,
      fixture: { ...fixture, port: fixture.devPort as number },
    })
  })
}
