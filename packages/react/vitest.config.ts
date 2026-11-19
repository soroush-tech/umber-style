import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // A test helper, run by the tests that import it and by its own.
      exclude: [...coverageConfigDefaults.exclude, 'src/**/vitest.*.ts'],
      thresholds: { 100: true },
    },
    projects: [
      {
        // The client build, and the code that is not specific to a build.
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.server.test.{ts,tsx}', 'src/**/*.browser.test.{ts,tsx}'],
        },
      },
      {
        // The server build, with the `react-server` condition: `react` resolves to its server
        // build, where hooks do not exist and `cache` is real. It must be inlined, or Node resolves it.
        extends: true,
        resolve: { conditions: ['react-server'] },
        ssr: { resolve: { conditions: ['react-server'], externalConditions: ['react-server'] } },
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.server.test.{ts,tsx}'],
          server: { deps: { inline: [/react/] } },
        },
      },
    ],
  },
})
