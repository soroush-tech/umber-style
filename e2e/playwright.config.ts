import { defineConfig, devices } from '@playwright/test'
import { fixtures } from './fixtures'

// E2E_FIXTURE=vike-ssg,spa runs a subset (CI runs one fixture in each matrix row).
const selected = process.env.E2E_FIXTURE?.split(',').filter(Boolean)
const active = fixtures.filter((fixture) => !selected || selected.includes(fixture.name))

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // The reports go to a folder that git ignores.
  outputDir: './reports/test-results',
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: './reports/html', open: 'never' }]]
    : 'list',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  use: { headless: true, trace: 'retain-on-failure' },
  projects: active.map((fixture) => ({
    name: fixture.name,
    metadata: { fixture: fixture.name },
    // The specs of one fixture are not run (and so not reported as skipped) by the others.
    testIgnore: fixtures
      .filter((other) => other.only && other.name !== fixture.name)
      .map((other) => `**/${other.only}`),
    use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${fixture.port}` },
  })),
  // Each fixture is built, and then served as it is in production.
  webServer: active.map((fixture) => ({
    command: `pnpm --filter ${fixture.filter} build && pnpm --filter ${fixture.filter} start`,
    url: `http://localhost:${fixture.port}/`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'ignore' as const,
    stderr: 'pipe' as const,
  })),
})
