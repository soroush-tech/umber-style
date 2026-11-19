import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      // The platform is not installed here: its one import resolves to a stand-in.
      {
        find: 'react-native',
        replacement: fileURLToPath(new URL('./vitest.react-native.ts', import.meta.url)),
      },
      // The entry that the type tests import by its package name: at run time it is the web binding.
      {
        find: /^umber-style\/react$/,
        replacement: fileURLToPath(new URL('./src/react.ts', import.meta.url)),
      },
    ],
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
