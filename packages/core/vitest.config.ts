import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: { 100: true },
    },
    projects: [
      {
        // Every test, outside production: a DOM sheet writes its rules as text.
        extends: true,
        test: {
          name: 'text',
          // The real-browser tier has its own config: vitest.browser.config.ts.
          exclude: [...configDefaults.exclude, '**/*.browser.test.*'],
        },
      },
      {
        // The tests of what a cache writes to a document, again as in production, where a DOM sheet
        // writes with insertRule: each behaviour holds in both ways of writing.
        extends: true,
        test: {
          name: 'insertRule',
          include: ['src/cache*.test.ts', 'src/createEngine*.test.ts'],
          env: { NODE_ENV: 'production' },
        },
      },
    ],
  },
})
