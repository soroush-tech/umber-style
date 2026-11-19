import { chromium, type FullConfig } from '@playwright/test'

/**
 * Loads every page of every development server once, before the first test. A development server
 * compiles on the first request, and Vite reloads the page once when it finds a dependency it had not
 * optimized: both are over after the warm-up, so a test sees a steady server. Each load waits on
 * conditions (the app took over the page, no request is pending), never on a fixed time.
 */
export default async function warmUp(config: FullConfig): Promise<void> {
  const browser = await chromium.launch()
  try {
    for (const project of config.projects) {
      const baseURL = project.use.baseURL as string
      const context = await browser.newContext({ baseURL })
      const page = await context.newPage()
      for (const route of ['/', '/catalog', '/settings', '/']) {
        await page.goto(route)
        await page.waitForSelector('html[data-hydrated="true"]')
        await page.waitForLoadState('networkidle')
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }
}
