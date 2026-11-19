import type { CDPSession, Page } from '@playwright/test'

/** The style elements of the engine: the cache's own element, or the elements a server component renders. */
export const ENGINE_STYLE_SELECTOR = 'style[data-style="umber"], style[data-precedence="umber"]'

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

export interface EngineClassFindings {
  /** Elements that carry an engine class that no rule of the engine's sheets names. */
  withoutRule: string[]
  /** `var(--umber-*)` references of a matched rule that compute to an empty value on the element. */
  emptyVariables: string[]
  /** How many elements with an engine class were looked at. */
  checked: number
}

/**
 * Every element under `root` with an engine class has at least one rule in the engine's sheets that
 * names the class, and every `var(--umber-*)` that its matching rules use has a value on it.
 */
export async function checkEngineClasses(page: Page, root: string): Promise<EngineClassFindings> {
  return page.evaluate(
    ({ rootSelector, selector }) => {
      const rules: CSSStyleRule[] = []
      const collect = (list: CSSRuleList) => {
        for (const rule of list) {
          if (rule instanceof CSSStyleRule) rules.push(rule)
          else if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules)
        }
      }
      for (const element of document.querySelectorAll<HTMLStyleElement>(selector)) {
        if (element.sheet) collect(element.sheet.cssRules)
      }
      // Marker classes that have no rule of their own.
      const markers = /^umber-(boundary|scheme-(light|dark))$/
      const findings = { withoutRule: [] as string[], emptyVariables: [] as string[], checked: 0 }
      const start = document.querySelector(rootSelector)
      if (!start) throw new Error(`No element matches ${rootSelector}`)
      const stateful = /:(hover|focus|active|focus-visible|focus-within)\b/
      for (const element of [start, ...start.querySelectorAll('*')]) {
        const classes = [...element.classList].filter(
          (name) => name.startsWith('umber-') && !markers.test(name)
        )
        if (classes.length === 0) continue
        findings.checked += 1
        const label = `${element.tagName.toLowerCase()}[${element.getAttribute('data-testid') ?? ''}]`
        for (const name of classes) {
          const named = rules.some((rule) =>
            new RegExp(`\\.${name}(?![\\w-])`).test(rule.selectorText)
          )
          if (!named) findings.withoutRule.push(`${label} .${name}`)
        }
        const computed = getComputedStyle(element)
        for (const rule of rules) {
          if (stateful.test(rule.selectorText)) continue
          let matches = false
          try {
            matches = element.matches(rule.selectorText)
          } catch {
            matches = false
          }
          if (!matches) continue
          for (const [, variable] of rule.cssText.matchAll(/var\((--umber-[\w-]+)/g)) {
            if (computed.getPropertyValue(variable).trim() === '') {
              findings.emptyVariables.push(`${label} ${variable} in ${rule.selectorText}`)
            }
          }
        }
      }
      return findings
    },
    { rootSelector: root, selector: ENGINE_STYLE_SELECTOR }
  )
}
