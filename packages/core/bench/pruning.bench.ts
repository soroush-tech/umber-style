// What one operation is, in this file:
//   scan variables  one `scanVariables(css, '--b-')`: the pass that finds the names of the variables
//                   that a rule refers to. "One rule" has three references; "a large rule set" is the
//                   text of the large style compiled with 40 references in it.
//   mark used       one pass of 127 `cache.markUsed([name])` calls, one for each variable of the large
//                   theme's palette, none used before, with five theme classes of the large theme
//                   registered: each variable is declared in each of the five (the sheet replaces the
//                   theme's rule five times). A fresh cache is made before each operation and is not
//                   timed. Divide by 127 for one newly used variable. "Used already" is the same pass
//                   when nothing is new.
import { compileRules, createCache, createEngine, createMemorySheet } from '../src'
import type { StyleObject } from '../src'
import { scanVariables } from '../src/variables'
import { runGroup } from '@umber-bench/shared/harness'
import { createLargeStyle } from '@umber-bench/shared/styles'
import { cloneTheme, createLargeTheme, type LargeTheme } from '@umber-bench/shared/themes'

const large = createLargeTheme()

/** A large style that uses `count` tokens of the theme, as references. */
function createReferenceStyle(refs: LargeTheme, count: number): StyleObject {
  const style: Record<string, string> = {}
  const properties = Object.keys(refs.palette).slice(0, count)
  properties.forEach((key, index) => {
    style[`--prop-${index}`] = refs.palette[key]
  })
  return { ...(createLargeStyle() as StyleObject), ...style }
}

it('scanning rules for used variables', async (context) => {
  const engine = createEngine(large, { prefix: 'b' })
  const oneRule =
    '.b-x{color:var(--b-palette-text);padding:var(--b-space-2);margin:var(--b-space-4);}'
  const largeRules = compileRules('.b-x', createReferenceStyle(engine.refs, 40)).join('')
  await runGroup(context, 'scanning rules for used variables', [
    {
      name: 'scan variables: one rule, three references',
      fn: () => scanVariables(oneRule, '--b-'),
    },
    {
      name: 'scan variables: a large rule set, 40 references',
      fn: () => scanVariables(largeRules, '--b-'),
    },
  ])
})

it('marking variables used', async (context) => {
  const names = Object.keys(createEngine(large, { prefix: 'b' }).refs.palette)
    .slice(0, 127)
    .map((key) => `--b-palette-${key}`)
  const themes = Array.from({ length: 5 }, (_, index) => {
    const theme = cloneTheme(large)
    theme.palette.text = `#00000${index}`
    return theme
  })
  const createFiveThemes = () => {
    const engine = createEngine(large, {
      prefix: 'b',
      cache: createCache({ prefix: 'b', sheet: createMemorySheet() }),
    })
    for (const theme of themes) engine.themeClass(theme)
    return engine.cache
  }
  let cache = createFiveThemes()
  const used = createFiveThemes()
  used.markUsed(names)
  await runGroup(context, 'marking variables used', [
    {
      name: 'mark used: 127 new variables one by one, five theme classes',
      // A new cache for each operation, made before it and not timed.
      beforeEach: () => {
        cache = createFiveThemes()
      },
      fn: () => {
        for (const name of names) cache.markUsed([name])
      },
    },
    {
      name: 'mark used: 127 variables that are used already',
      fn: () => {
        for (const name of names) used.markUsed([name])
      },
    },
  ])
})
