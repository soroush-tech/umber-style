import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // The harness runs inside every benchmark file (it needs the runner's `bench` and writes files);
      // each benchmark run exercises it, and a unit test would only repeat a stand-in of the runner.
      // The two bin scripts are one-line entries into the tested modules.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/harness.ts'],
      thresholds: { 100: true },
    },
  },
})
