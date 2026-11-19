import { loadPage, PAGE_NAMES, storeScheme } from '../helpers/navigation'
import { expect, test } from '../helpers/dev'

// The first load of each page in development, in each way a scheme can reach the page. The
// `messages` fixture fails the test on a hydration message, an error, or a warning of the engine.
const VARIANTS = [
  { name: 'light', scheme: /scheme-light/, setup: async () => {} },
  {
    name: 'dark stored',
    scheme: /scheme-dark/,
    setup: async (page: Parameters<typeof storeScheme>[0]) => storeScheme(page, 'dark'),
  },
  {
    name: 'light stored',
    scheme: /scheme-light/,
    setup: async (page: Parameters<typeof storeScheme>[0]) => storeScheme(page, 'light'),
  },
  {
    name: 'dark system preference',
    scheme: /scheme-(light|dark)/,
    setup: async (page: Parameters<typeof storeScheme>[0]) =>
      page.emulateMedia({ colorScheme: 'dark' }),
  },
] as const

for (const variant of VARIANTS) {
  for (const name of PAGE_NAMES) {
    test(`hydration: ${name} loads clean, ${variant.name}`, async ({ page, fixture }) => {
      await variant.setup(page)
      await loadPage(page, fixture, name)
      await expect(page.locator('html')).toHaveClass(variant.scheme)
    })
  }
}
