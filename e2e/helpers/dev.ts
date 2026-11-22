import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { test as base, expect } from './test'
import { ENGINE_STYLE_SELECTOR } from './rules'

const here = dirname(fileURLToPath(import.meta.url))

/** The source files of the fixtures that the hot replacement tests edit, by name. */
export const SOURCE_FILES = {
  components: join(here, '..', '..', 'fixtures', 'shared', 'src', 'components.tsx'),
  pages: join(here, '..', '..', 'fixtures', 'shared', 'src', 'pages.tsx'),
} as const

const HYDRATION = /hydrat|did not match|mismatch|server rendered HTML/i

/** What the `messages` fixture collects from the page of a test. */
export interface Messages {
  /** Every console message and page error seen so far, as `type: text`. */
  readonly all: string[]
  /** The messages that fail the test: a hydration message of any kind, an error, an uncaught error, a warning of the engine. */
  readProblems(): string[]
}

/**
 * `test` of the production tier, and a `messages` fixture that collects every console message and
 * page error. The test fails when any of them is a hydration message, an error, an uncaught error, or a
 * warning of the engine's development checker (`[umber] ...`).
 */
export const test = base.extend<{ messages: Messages }>({
  messages: [
    async ({ page }, use) => {
      const all: string[] = []
      page.on('console', (message) => all.push(`${message.type()}: ${message.text()}`))
      page.on('pageerror', (error) => all.push(`pageerror: ${error.message}`))
      const messages: Messages = {
        all,
        readProblems: () =>
          all.filter(
            (line) =>
              line.startsWith('error: ') ||
              line.startsWith('pageerror: ') ||
              line.includes('[umber]') ||
              HYDRATION.test(line)
          ),
      }
      await use(messages)
      expect(
        messages.readProblems(),
        'hydration messages, errors and warnings of the engine'
      ).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/**
 * Changes the text of a source file once, and returns what puts it back. The text to replace must
 * occur exactly once. The file is restored byte for byte from what was read.
 */
export function editSource(file: string, from: string, to: string): () => void {
  const original = readFileSync(file)
  const text = original.toString('utf8')
  if (text.split(from).length !== 2) throw new Error(`"${from}" is not once in ${file}`)
  writeFileSync(
    file,
    text.replace(from, () => to)
  )
  return () => writeFileSync(file, original)
}

/** The classes of the engine on the element with `testId`, without the markers that have no rule. */
export async function readEngineClasses(page: Page, testId: string): Promise<string[]> {
  return page
    .getByTestId(testId)
    .evaluate((element) =>
      [...element.classList].filter(
        (name) =>
          name.startsWith('umber-') &&
          !['umber-boundary', 'umber-scope', 'umber-scheme-light', 'umber-scheme-dark'].includes(
            name
          )
      )
    )
}

/** How many rules of the engine's style elements have exactly `.className` as their selector, outside a media query. */
export async function countRulesFor(page: Page, className: string): Promise<number> {
  return page.evaluate(
    ({ selector, name }) => {
      let count = 0
      const visit = (list: CSSRuleList, isConditional: boolean) => {
        for (const rule of list) {
          if (rule instanceof CSSStyleRule) {
            if (!isConditional && rule.selectorText === `.${name}`) count += 1
          } else if ('cssRules' in rule) {
            visit((rule as CSSGroupingRule).cssRules, isConditional || rule instanceof CSSMediaRule)
          }
        }
      }
      for (const element of document.querySelectorAll<HTMLStyleElement>(selector)) {
        if (element.sheet) visit(element.sheet.cssRules, false)
      }
      return count
    },
    { selector: ENGINE_STYLE_SELECTOR, name: className }
  )
}

/** The rules of the engine's style elements that appear more than once, with the groups around them. */
export async function findDuplicateRules(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const seen = new Map<string, number>()
    const visit = (list: CSSRuleList, path: string) => {
      for (const rule of list) {
        if (rule instanceof CSSStyleRule) {
          const key = `${path} ${rule.cssText}`
          seen.set(key, (seen.get(key) ?? 0) + 1)
        } else if ('cssRules' in rule) {
          visit((rule as CSSGroupingRule).cssRules, `${path} ${rule.cssText.split('{')[0].trim()}`)
        }
      }
    }
    for (const element of document.querySelectorAll<HTMLStyleElement>(selector)) {
      if (element.sheet) visit(element.sheet.cssRules, '')
    }
    return [...seen].filter(([, times]) => times > 1).map(([key, times]) => `${times}x ${key}`)
  }, ENGINE_STYLE_SELECTOR)
}
