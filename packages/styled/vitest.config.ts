import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: { 100: true },
    },
    projects: [
      {
        // The client build of `@umber-style/react`.
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.server.test.{ts,tsx}'],
        },
      },
      {
        // The `react-server` condition: `@umber-style/react` resolves to its server build, and `react`
        // to its own. They must be inlined, or Node resolves them without the condition.
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
