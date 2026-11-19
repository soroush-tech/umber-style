import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // The real-browser tier has its own config: vitest.browser.config.ts.
    exclude: [...configDefaults.exclude, '**/*.browser.test.*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: { 100: true },
    },
  },
})
