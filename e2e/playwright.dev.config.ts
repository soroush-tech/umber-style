import { defineConfig, devices } from '@playwright/test'
import { fixtures } from './fixtures'

// The development tier: the fixtures that have a development server, each started with its own `dev`
// script. `pnpm test:e2e:dev` runs it; E2E_FIXTURE=spa narrows it like the production run.
const selected = process.env.E2E_FIXTURE?.split(',').filter(Boolean)
const active = fixtures.filter(
  (fixture) => fixture.devPort !== undefined && (!selected || selected.includes(fixture.name))
)

export default defineConfig({
  testDir: './dev-tests',
  testMatch: '**/*.spec.ts',
  outputDir: './reports/test-results-dev',
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: './reports/html-dev', open: 'never' }]]
    : 'list',
  // One test at a time: the hot replacement tests write files that every fixture shares, and the
  // first request to a development server compiles the page, so a crowd of loads is slow.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: { headless: true, trace: 'retain-on-failure' },
  globalSetup: './dev-tests/warmUp.ts',
  projects: active.map((fixture) => ({
    name: fixture.name,
    metadata: { fixture: fixture.name },
    use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${fixture.devPort}` },
  })),
  webServer: active.map((fixture) => ({
    command: `pnpm --filter ${fixture.filter} dev`,
    url: `http://localhost:${fixture.devPort}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore' as const,
    stderr: 'pipe' as const,
  })),
})
