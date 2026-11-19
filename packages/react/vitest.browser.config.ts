import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Real-browser tier: only *.browser.test.* files, run in headless Chromium. It is a config of its own,
// so `pnpm test` and `pnpm test:coverage` stay jsdom-only and need no browser download.
export default defineConfig({
  test: {
    name: 'browser',
    globals: true,
    include: ['src/**/*.browser.test.{ts,tsx}'],
    // Vitest's default API port can land in a Windows excluded port range (listen EACCES).
    api: { port: 51326 },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
