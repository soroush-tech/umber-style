import { test as base, expect, type Page } from '@playwright/test'
import { fixtureByName, type FixtureConfig } from '../fixtures'

export interface ProblemWatcher {
  /** The console errors, hydration warnings and uncaught errors seen so far. */
  readonly problems: string[]
}

const HYDRATION_WARNING = /hydrat|did not match|mismatch|server rendered HTML/i

/** Watches a page: the console errors, the warnings about hydration, and the uncaught errors. */
export function collectConsoleProblems(page: Page): ProblemWatcher {
  const problems: string[] = []
  page.on('console', (message) => {
    const type = message.type()
    if (type === 'error' || (type === 'warning' && HYDRATION_WARNING.test(message.text()))) {
      problems.push(`console.${type}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  return { problems }
}

/**
 * `test` with the fixture of the project, and a `page` that fails its test on any console error,
 * hydration warning or uncaught error seen while the test ran.
 */
export const test = base.extend<{ fixture: FixtureConfig; watcher: ProblemWatcher }>({
  fixture: async ({}, use, testInfo) => {
    await use(fixtureByName(testInfo.project.name))
  },
  watcher: [
    async ({ page }, use) => {
      const watcher = collectConsoleProblems(page)
      await use(watcher)
      expect(watcher.problems, 'console errors and hydration warnings').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Runs a test only for the fixtures that have the scenario; and marks it as a known failure when the fixture says so. */
export function scenario(
  letter: string,
  fixture: FixtureConfig,
  info: {
    skip(condition: boolean, description?: string): void
    fail(condition: boolean, description?: string): void
  },
  knownKey: string = letter
): void {
  info.skip(
    !fixture.scenarios.includes(letter),
    `scenario ${letter} does not apply to ${fixture.name}`
  )
  const known = fixture.known[knownKey]
  info.fail(known !== undefined, known)
}
