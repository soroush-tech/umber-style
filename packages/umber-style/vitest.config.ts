import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // The platform is not installed here: its one import resolves to a stand-in.
    alias: { 'react-native': fileURLToPath(new URL('./vitest.react-native.ts', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: { 100: true },
    },
  },
})
