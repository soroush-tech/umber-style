import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CDPSession, Page } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))

/** The prefix that the fixtures give the engine. */
const ENGINE_PREFIX = 'umber'

/** The style elements of the engine: the cache's own element, or the elements a server component renders. */
export const ENGINE_STYLE_SELECTOR = `style[data-style="${ENGINE_PREFIX}"], style[data-precedence="${ENGINE_PREFIX}"]`

/** The number of rules in the engine's style sheets, counted at the top level of each sheet. */
export async function collectEngineRuleCount(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    let count = 0
    for (const element of document.querySelectorAll<HTMLStyleElement>(selector)) {
      count += element.sheet?.cssRules.length ?? 0
    }
    return count
  }, ENGINE_STYLE_SELECTOR)
}

/** The number of engine style elements in the document. */
export async function countEngineStyleElements(page: Page): Promise<number> {
  return page.evaluate(
    (selector) => document.querySelectorAll(selector).length,
    ENGINE_STYLE_SELECTOR
  )
}

export interface UnusedRule {
  /** The text of the rule, as the sheet has it. */
  text: string
}

export interface RuleUsageReport {
  /** The rules that can be "used" at load: style rules of the engine's sheets, less the ignored ones. */
  total: number
  /** Of `total`, the rules that matched no element. */
  unused: UnusedRule[]
  /** The size in bytes of the rules in `total`. */
  bytesTotal: number
  /** The size in bytes of the unused rules. */
  bytesUnused: number
  /** The rules that were left out of `total`, by reason. */
  ignored: Record<IgnoreReason, number>
}

/**
 * What the report leaves out, and why. A rule that cannot be "used" at load by nature is not counted
 * against the page:
 * - `state`: a `:hover`, `:focus`, `:active` or `:focus-visible` rule applies only while the user does that.
 * - `media`: a rule inside an `@media` whose condition is false for the viewport of the test.
 * - `property`: an `@property` rule is a registry, not a style that matches elements.
 * - `themeClass`: a theme class rule (`.umber-theme-*`) is offered for switching: the theme that is not
 *   applied at load is not used at load, and is meant to be there.
 * - `layerOrder`: the `@layer a, b, c;` statement has no selector.
 */
export type IgnoreReason = 'state' | 'media' | 'property' | 'themeClass' | 'layerOrder'

interface Entry {
  styleSheetId: string
  startOffset: number
  endOffset: number
  used: boolean
}

const STATE_PATTERN = /:(hover|focus|active|focus-visible|focus-within)\b/

/**
 * Tracks which rules of the engine's sheets are used while `action` runs (a navigation, usually), with
 * the Chrome DevTools Protocol: `CSS.startRuleUsageTracking` before it and `CSS.stopRuleUsageTracking`
 * after it. A rule is used when it matched an element at any time in between.
 */
export async function collectUnusedRules(
  page: Page,
  action: () => Promise<void>
): Promise<RuleUsageReport> {
  const session = await page.context().newCDPSession(page)
  const headers = new Map<string, { ownerNode?: number }>()
  session.on('CSS.styleSheetAdded', ({ header }) => headers.set(header.styleSheetId, header))
  await session.send('DOM.enable')
  await session.send('CSS.enable')
  await session.send('CSS.startRuleUsageTracking')
  await action()
  const { ruleUsage } = await session.send('CSS.stopRuleUsageTracking')

  const report: RuleUsageReport = {
    total: 0,
    unused: [],
    bytesTotal: 0,
    bytesUnused: 0,
    ignored: { state: 0, media: 0, property: 0, themeClass: 0, layerOrder: 0 },
  }
  const viewportMatches = (query: string) =>
    page.evaluate((text) => matchMedia(text).matches, query).catch(() => true)

  for (const [styleSheetId, header] of headers) {
    if (!(await isEngineSheet(session, header.ownerNode))) continue
    const { text } = await session.send('CSS.getStyleSheetText', { styleSheetId })
    // The protocol reports the rules that were used, and not the others: a rule is unused when the
    // text of the sheet has it and no used entry starts where it starts.
    const used = new Set(
      (ruleUsage as Entry[])
        .filter((entry) => entry.styleSheetId === styleSheetId && entry.used)
        .map((entry) => entry.startOffset)
    )
    for (const rule of listRules(text)) {
      const around = rule.context.join(' ')
      const reason = await ignoreReason(rule.text, around, viewportMatches)
      if (reason) {
        report.ignored[reason] += 1
        continue
      }
      report.total += 1
      report.bytesTotal += rule.text.length
      if (!used.has(rule.start)) {
        report.unused.push({ text: rule.text })
        report.bytesUnused += rule.text.length
      }
    }
  }
  await session.detach()
  return report
}

interface ListedRule {
  start: number
  text: string
  /** The preludes of the blocks around it, outermost first: `@layer umber-components`, `@media (...)`. */
  context: string[]
}

/** The innermost rules of a sheet's text (the ones that hold declarations), with where each starts. */
export function listRules(text: string): ListedRule[] {
  const rules: ListedRule[] = []
  const stack: { prelude: string; start: number; hasChild: boolean }[] = []
  let boundary = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '{') {
      const raw = text.slice(boundary, index)
      const prelude = raw.trim()
      const start = boundary + raw.length - raw.trimStart().length
      if (stack.length > 0) stack[stack.length - 1].hasChild = true
      stack.push({ prelude, start, hasChild: false })
      boundary = index + 1
    } else if (char === '}') {
      const block = stack.pop()
      if (block && !block.hasChild) {
        rules.push({
          start: block.start,
          text: text.slice(block.start, index + 1),
          context: stack.map((parent) => parent.prelude),
        })
      }
      boundary = index + 1
    } else if (char === ';' && stack.length === 0) {
      boundary = index + 1
    }
  }
  return rules
}

async function isEngineSheet(session: CDPSession, ownerNode?: number): Promise<boolean> {
  if (ownerNode === undefined) return false
  try {
    const { node } = await session.send('DOM.describeNode', { backendNodeId: ownerNode })
    const attributes = node.attributes ?? []
    const read = (name: string) => attributes[attributes.indexOf(name) + 1]
    return read('data-style') === 'umber' || read('data-precedence') === 'umber'
  } catch {
    return false
  }
}

async function ignoreReason(
  ruleText: string,
  around: string,
  viewportMatches: (query: string) => Promise<boolean>
): Promise<IgnoreReason | undefined> {
  if (
    /^\s*@property/.test(ruleText) ||
    (/\bsyntax\s*:/.test(ruleText) && /inherits\s*:/.test(ruleText))
  ) {
    return 'property'
  }
  if (/^\s*@layer\s[^{]*;?\s*$/.test(ruleText)) return 'layerOrder'
  const selector = ruleText.slice(0, ruleText.indexOf('{'))
  if (/\.umber-theme-[a-z0-9]+\b/.test(selector) && !/\s/.test(selector.trim())) return 'themeClass'
  if (STATE_PATTERN.test(selector)) return 'state'
  const media = /@media\s*([^{]*)\{/.exec(around)
  if (media && !(await viewportMatches(media[1].trim()))) return 'media'
  return undefined
}

/** The compiled text of the core's checker: the one file that the development mode runs too. */
let checkerSource: string | undefined
function readCheckerSource(): string {
  if (checkerSource === undefined) {
    const file = join(here, '..', '..', 'packages', 'core', 'src', 'findMissingStyles.ts')
    checkerSource = stripTypeScriptTypes(readFileSync(file, 'utf8'))
  }
  return checkerSource
}

export interface MissingStyle {
  kind: 'class-without-rule' | 'variable-without-value'
  name: string
  element: string
  message: string
  key: string
}

/**
 * `findMissingStyles` of `@umber-style/core`, run in the page on the elements under `root`: every
 * engine class has a rule, and every variable that a matched rule uses has a value. The function is
 * not imported into the page: its source is sent to it, so the test and the development warning
 * share one implementation.
 */
export async function findMissingStyles(
  page: Page,
  root: string = 'html'
): Promise<MissingStyle[]> {
  await page.addScriptTag({
    type: 'module',
    content: `${readCheckerSource()}
window.__findMissingStyles = findMissingStyles`,
  })
  await page.waitForFunction(() => '__findMissingStyles' in window)
  return page.evaluate((selector) => {
    const start = document.querySelector(selector)
    if (!start) throw new Error(`No element matches ${selector}`)
    const check = (window as unknown as { __findMissingStyles: (root: Element) => MissingStyle[] })
      .__findMissingStyles
    return check(start)
  }, root)
}

/** How many elements under `root` (the root included) carry a class of the engine. */
export async function countEngineElements(page: Page, root: string = 'html'): Promise<number> {
  return page.evaluate(
    ({ selector, prefix }) => {
      const start = document.querySelector(selector)
      if (!start) throw new Error(`No element matches ${selector}`)
      return [start, ...start.querySelectorAll('*')].filter((element) =>
        [...element.classList].some((name) => name.startsWith(`${prefix}-`))
      ).length
    },
    { selector: root, prefix: ENGINE_PREFIX }
  )
}
