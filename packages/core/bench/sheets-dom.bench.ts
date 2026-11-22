// What one operation is, in this file: `createDomSheet('b', head, { hasRuleText })` in the document of
// jsdom, then the rules of N distinct classes inserted into it one after the other, then its style element
// removed. The rules are what a cache writes for those classes (the layer order statement, then a rule and
// a hover rule for each class, each in its layer), made once before the cases. With `hasRuleText` each
// rule is a text node of the element; without it, a call of `insertRule`.
//   N is 200 and 800 for text nodes, and 200, 800 and 3200 for `insertRule`. jsdom parses the whole text
//   of the element again on every text node, so text mode grows with the square of N: one operation of
//   800 took 49 seconds in the sandbox, and one of 3200 would take about thirteen minutes, twelve times
//   over for the samples a case needs. Add 3200 to `TEXT_SIZES` once text mode no longer parses the
//   element again.
// jsdom's style sheets and CSS parser are not a browser's; the figures say how each way of writing grows
// with N, which is what a change to the text sheet is measured by.
import type { BenchConfig } from '@soroush.tech/bench'
import { createDistinctStyles } from '../../../bench/src/styles'
import { core } from './core'
import { window } from './dom'

const RULE_SIZES = [200, 800, 3200]
const TEXT_SIZES = [200, 800]

/** The rules a cache writes for `count` distinct classes, in the order it writes them. */
function createRules(count: number): string[] {
  const sheet = core.createMemorySheet()
  const cache = core.createCache({ prefix: 'b', sheet })
  for (const style of createDistinctStyles(count)) cache.css(style)
  return [...sheet.rules]
}

const rules = new Map(RULE_SIZES.map((count) => [count, createRules(count)]))
const { head } = window.document

/** One operation: a sheet in a new style element, the rules of `count` classes, and the element removed. */
const insertClasses = (count: number, hasRuleText: boolean) => () => {
  const sheet = core.createDomSheet('b', head, { hasRuleText })
  for (const rule of rules.get(count) as string[]) sheet.insert(rule)
  head.querySelector('style[data-style="b"]')?.remove()
  return sheet
}

export default {
  name: 'core: writing rules into a style element',
  cases: {
    ...Object.fromEntries(
      TEXT_SIZES.map((count) => [`text nodes: ${count} classes`, insertClasses(count, true)])
    ),
    ...Object.fromEntries(
      RULE_SIZES.map((count) => [`insertRule: ${count} classes`, insertClasses(count, false)])
    ),
  },
} satisfies BenchConfig
