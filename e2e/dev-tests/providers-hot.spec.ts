import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { waitForHydrated } from '../helpers/navigation'
import { readRootRules } from '../helpers/providers'
import { editSource, expect, test } from '../helpers/dev'

// The theme object of a root layout and of a nested page provider is edited while the development
// server runs: the page takes the new theme with no document load and no warning of the engine, and one
// root rule stays live. Only the App Router fixture has these routes. The file is put back after each
// test, and the page is seen with the original value again before the next one.
const THEMES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
  'next-app',
  'app',
  'scheme-themes.ts'
)

const restores: Array<() => void> = []

test.beforeEach(({ fixture }, info) => {
  info.skip(fixture.name !== 'next-app', 'the routes of these tests are in the App Router fixture')
})

test.afterEach(async ({ page, fixture }) => {
  if (fixture.name !== 'next-app') return
  try {
    await expect(async () => {
      for (const restore of restores) restore()
      await expect(page.getByTestId('s-root-card')).toHaveCSS(
        'background-color',
        'rgb(244, 241, 238)',
        { timeout: 3000 }
      )
      await expect(page.getByTestId('s-brand-card')).toHaveCSS(
        'background-color',
        'rgb(255, 244, 214)',
        { timeout: 3000 }
      )
    }).toPass()
  } finally {
    for (const restore of restores) restore()
    restores.length = 0
  }
})

/** Loads the brand page and puts a marker on `window` that a document load would remove. */
async function loadBrand(page: Page): Promise<void> {
  await page.goto('/s/brand')
  await page.getByTestId('page-s-brand').waitFor()
  await waitForHydrated(page)
  await page.evaluate(() => {
    ;(window as unknown as { __hasStayed: boolean }).__hasStayed = true
  })
}

async function expectStayed(page: Page): Promise<void> {
  const hasStayed = await page.evaluate(
    () => (window as unknown as { __hasStayed?: boolean }).__hasStayed
  )
  expect(hasStayed, 'the page did not reload').toBe(true)
}

test('hot replacement: the theme of the root layout is edited', async ({ page }) => {
  await loadBrand(page)
  restores.push(editSource(THEMES, "surface: '#f4f1ee'", "surface: '#dcdcdc'"))
  await expect(page.getByTestId('s-root-card')).toHaveCSS('background-color', 'rgb(220, 220, 220)')
  await expect(page.getByTestId('s-brand-card')).toHaveCSS('background-color', 'rgb(255, 244, 214)')
  await expect.poll(() => readRootRules(page)).toHaveLength(1)
  await expectStayed(page)
})

test('hot replacement: the theme of a nested page provider is edited', async ({ page }) => {
  await loadBrand(page)
  const wrapper = page.getByTestId('s-brand-card').locator('xpath=..')
  await expect(wrapper).toHaveClass(/umber-scope/)
  restores.push(editSource(THEMES, "surface: '#fff4d6'", "surface: '#d6f0ff'"))
  await expect(page.getByTestId('s-brand-card')).toHaveCSS('background-color', 'rgb(214, 240, 255)')
  await expect(page.getByTestId('s-brand-card').locator('xpath=..')).toHaveClass(/umber-scope/)
  await expect(page.getByTestId('s-root-card')).toHaveCSS('background-color', 'rgb(244, 241, 238)')
  await expect.poll(() => readRootRules(page)).toHaveLength(1)
  await expectStayed(page)
})
