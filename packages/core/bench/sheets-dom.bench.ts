// What one operation is, in this file: `createDomSheet('b', head, { speedy })` in the document of
// jsdom, then the rules of N distinct classes inserted into it one after the other, then its style
// elements removed. The rules are what a cache writes for those classes (the layer order statement, then a
// rule and a hover rule for each class, each in its layer), made once before the cases. Without `speedy`
// each rule is the text of a style element of its own; with it, a call of `insertRule` into one element.
//   N is 200 and 800 for text, and 200, 800 and 3200 for `insertRule`. When text mode wrote every rule as
//   a text node of one element, jsdom parsed the whole text of the element again for each node, and the
//   time grew with the square of N (800 took 49 seconds an operation). Each element now parses its own rule
//   once, and text grows with N. 3200 by text runs the sandbox out of memory: jsdom keeps every style
//   element that was ever in its document after it is removed (a few kilobytes each, measured on its own,
//   without the engine), and one operation of 3200 classes makes 6401 of them.
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

/** One operation: a sheet in a new style element, the rules of `count` classes, and the elements removed. */
const insertClasses = (count: number, speedy: boolean) => () => {
  const sheet = core.createDomSheet('b', head, { speedy })
  for (const rule of rules.get(count) as string[]) sheet.insert(rule)
  for (const element of head.querySelectorAll('style[data-style="b"]')) element.remove()
  return sheet
}

export default {
  name: 'core: writing rules into a style element',
  cases: {
    ...Object.fromEntries(
      TEXT_SIZES.map((count) => [`text nodes: ${count} classes`, insertClasses(count, false)])
    ),
    ...Object.fromEntries(
      RULE_SIZES.map((count) => [`insertRule: ${count} classes`, insertClasses(count, true)])
    ),
  },
} satisfies BenchConfig
