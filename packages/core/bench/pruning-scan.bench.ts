// What one operation is, in this file: one `scanVariables(css, '--b-')`, the pass that finds the names
// of the variables that a rule refers to. "One rule" has three references; "a large rule set" is the
// text of the large style compiled with 40 references in it. The built core does not export
// `scanVariables`, so the scan runs the source (`src/variables.ts`), which tsx compiles in the sandbox;
// the rules are compiled by the build.
import type { BenchConfig } from '@soroush.tech/bench'
import { createLargeStyle } from '../../../bench/src/styles'
import { createLargeTheme, type LargeTheme } from '../../../bench/src/themes'
import type { StyleObject } from '../src/index'
import { scanVariables } from '../src/variables'
import { core } from './core'

/** A large style that uses `count` tokens of the theme, as references. */
function createReferenceStyle(refs: LargeTheme, count: number): StyleObject {
  const style: Record<string, string> = {}
  const properties = Object.keys(refs.palette).slice(0, count)
  properties.forEach((key, index) => {
    style[`--prop-${index}`] = refs.palette[key]
  })
  return { ...(createLargeStyle() as StyleObject), ...style }
}

const engine = core.createEngine(createLargeTheme(), { prefix: 'b' })
const oneRule =
  '.b-x{color:var(--b-palette-text);padding:var(--b-space-2);margin:var(--b-space-4);}'
const largeRules = core.compileRules('.b-x', createReferenceStyle(engine.refs, 40)).join('')

export default {
  name: 'core: scanning rules for used variables',
  cases: {
    'scan variables: one rule, three references': () => scanVariables(oneRule, '--b-'),
    'scan variables: a large rule set, 40 references': () => scanVariables(largeRules, '--b-'),
  },
} satisfies BenchConfig
