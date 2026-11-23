// What one operation is, in this file: each option of the cache switched on and then off (`hasLayers`,
// `hasBaseClass`, `hasPruning`, `hasLabels`, `hasColorFallbacks`, `hasScope`), the others at their
// defaults, for the same two cases, so that the four rows of an option compare like with like. The
// component is the prop-driven one of the other files with more in its style, so that every option has
// something to change: fixed styles before a function of six props (the base class), a theme colour (the
// variables that pruning declares), `alpha()` of a theme colour (the colour fallback), a `when()` key
// that applies inside another theme (the scoped condition), and a name (the label).
//   cold   one `renderToString` of a provider with 48 elements of it, one of 48 combinations each, with a
//          fresh engine and cache made inside the operation: every class is made during the render. The
//          fresh engine is the same work on both settings.
//   warm   the same render over a cache that already holds the classes: only what the option does on the
//          way to a class that exists shows.
// Client build of the binding, production React, no `document` (so the style elements of each class are
// rendered too, as a classic server render does); the engine writes into an in-memory sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import type * as React from 'react'
import { binding, fixtures, renderToString } from './client'
import { createLayoutKey, LAYOUT_PROPS } from '../../../bench/src/components'
import { createLayoutStyle, LAYOUT_FIXED, type LayoutProps } from '../../../bench/src/styles'
import { combinations, otherTheme, theme } from './fixtures'

const load = createRequire(import.meta.url)
const core = load('../../core/dist/index.cjs') as typeof Core
const { createElement: h } = load('react') as typeof React

const OPTIONS = [
  'hasLayers',
  'hasBaseClass',
  'hasPruning',
  'hasLabels',
  'hasColorFallbacks',
  'hasScope',
] as const

/** A fresh style object with `options`, and the element of 48 of its component inside a provider. */
function createElement(options: Core.CacheOptions) {
  const cache = core.createCache({
    prefix: 'b',
    sheet: core.createMemorySheet(),
    hasDevChecks: false,
    ...options,
  })
  const style = binding.createStyle(theme, { prefix: 'b', cache })
  const Option = style.styled('div', {
    name: 'Option',
    shouldForwardProp: (prop) => !LAYOUT_PROPS.has(prop),
  })<LayoutProps>(LAYOUT_FIXED, (props) => ({
    ...createLayoutStyle(props),
    color: props.theme.palette.text,
    backgroundColor: core.alpha(props.theme.palette.primary, 0.2),
    [style.when(otherTheme)]: { borderColor: props.theme.palette.border },
  }))
  return fixtures.provide(
    style,
    combinations.map((props) => h(Option, { key: createLayoutKey(props), ...props }))
  )
}

/** The cold and warm cases of `option` set to `value`. */
function createCases(option: (typeof OPTIONS)[number], value: boolean) {
  const label = `${option} ${value ? 'on' : 'off'}`
  const options = { [option]: value }
  const warm = createElement(options)
  renderToString(warm)
  return [
    [`${label}: 48 combinations, cold`, () => renderToString(createElement(options))],
    [`${label}: 48 combinations, warm`, () => renderToString(warm)],
  ] as const
}

export default {
  name: 'react: the options of the cache, on and off',
  cases: Object.fromEntries(
    OPTIONS.flatMap((option) => [...createCases(option, true), ...createCases(option, false)])
  ),
} satisfies BenchConfig
