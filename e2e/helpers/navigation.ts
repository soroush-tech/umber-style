import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import type { FixtureConfig } from '../fixtures'

export type PageName = 'home' | 'catalog' | 'settings'
export const PAGE_NAMES: readonly PageName[] = ['home', 'catalog', 'settings']

/** The key under which the fixtures store the scheme (see fixtures/shared/src/themes.ts). */
export const STORAGE_KEY = 'umber-fixture-scheme'

/** The test id of the root element of each page (and of a page that some fixtures have, such as `promo`). */
export const pageTestId = (name: string) => `page-${name}`

/** Waits until React has taken the page over (the shell sets `data-hydrated` on <html>). */
export async function waitForHydrated(page: Page): Promise<void> {
  await page.waitForSelector('html[data-hydrated="true"]')
}

/** Loads a page directly and waits for hydration. */
export async function loadPage(page: Page, fixture: FixtureConfig, name: PageName): Promise<void> {
  await page.goto(fixture.routes[name])
  await page.getByTestId(pageTestId(name)).waitFor()
  await waitForHydrated(page)
}

/**
 * Moves to a page with the app's own link, in the browser. It fails when the click made a document
 * load instead of a client-side navigation: a marker on `window` must survive.
 */
export async function navigateInBrowser(page: Page, name: string): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as { __stayed: boolean }).__stayed = true
  })
  await page.getByTestId(`link-${name}`).click()
  await page.getByTestId(pageTestId(name)).waitFor()
  // The pointer rests on the link: move it off anything that has a :hover rule.
  await page.mouse.move(1, 700)
  const stayed = await page.evaluate(() => (window as unknown as { __stayed?: boolean }).__stayed)
  expect(stayed, 'the link made a document load, not a client-side navigation').toBe(true)
}

/** Stores a scheme before any script of the page runs, as a previous visit would have. */
export async function storeScheme(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, value)
      } catch {
        // Storage can be blocked.
      }
    },
    { key: STORAGE_KEY, value: scheme }
  )
}

const here = dirname(fileURLToPath(import.meta.url))
/** The folder that git ignores, where the suite writes what it measured. */
export const REPORT_DIR = join(here, '..', 'reports')

/** Writes `data` as JSON under the report folder. */
export function writeReport(file: string, data: unknown): void {
  const target = join(REPORT_DIR, file)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`)
}
