import { PROVIDER_SCENARIOS } from '../helpers/providers'
import { test } from '../helpers/dev'

// The scenarios of theme providers in the App Router fixture, on its development server, where React
// renders twice and runs effects twice (strict mode) and the framework compiles a route on its first
// request (see helpers/providers.ts). Only the App Router fixture has these routes.
for (const scenario of PROVIDER_SCENARIOS) {
  test(`providers ${scenario.title}`, async ({
    page,
    browser,
    fixture,
    messages,
    watcher,
  }, info) => {
    info.skip(
      fixture.name !== 'next-app',
      'the routes of these scenarios are in the App Router fixture'
    )
    const known = scenario.knownKey === undefined ? undefined : fixture.known[scenario.knownKey]
    info.fail(known !== undefined, known)
    await scenario.run(page, {
      browser,
      fixture: { ...fixture, port: fixture.devPort as number },
      markProblems: () => {
        const at = [messages.all.length, watcher.problems.length]
        return () => {
          messages.all.splice(at[0])
          watcher.problems.splice(at[1])
        }
      },
    })
  })
}
