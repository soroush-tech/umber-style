// What one operation is, in this file: the markup of one element styled with the small style (five
// declarations), rendered to a string, the cache warm (a call or a render before the measurement made
// the class).
//   css package      `css(style)` of an instance of this package, and its class name on a `div` rendered
//                    with `renderToString` of production React. The name alone, without React, is the
//                    first case: what the class costs next to the render.
//   styled component a `styled('div')` of the same style, made once with `createStyle` of the client
//                    build of `@umber-style/react`, rendered with `renderToString`. With no `document`
//                    that build also renders the style element of the class, as the first HTML of a
//                    client component holds it; the last case turns it off
//                    (`hasServerStyleElements: false`), so its markup is the same `div` as the css case.
// Each side has a cache of its own over an in-memory sheet. This package writes unlayered rules (its
// default), the binding layered ones: on a hit neither writes. The built `dist` of both packages is
// loaded after `prepareBuiltPackages`, which sends the `@umber-style/core` they require to the built
// core; React is loaded from the binding's folder, where it is a dependency.
import type { BenchConfig } from '@soroush.tech/bench'
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import { prepareBuiltPackages } from '../../../bench/src/built'
import { createSmallStyle } from '../../../bench/src/styles'
import type createInstanceSource from '../src/createInstance'

/** The part of React that this file uses: this package does not depend on React, so it is typed here. */
interface ReactParts {
  createElement(type: unknown, props?: Record<string, unknown> | null): unknown
}

/** The part of `@umber-style/react` that this file uses. */
interface BindingParts {
  createStyle(
    theme: object,
    options: { prefix: string; cache: Core.Cache; hasServerStyleElements?: boolean }
  ): { styled(tag: 'div', options: { name: string }): (style: Core.WebStyleObject) => unknown }
}

prepareBuiltPackages()
const load = createRequire(import.meta.url)
const loadFromBinding = createRequire(new URL('../../react/package.json', import.meta.url))
const core = load('../../core/dist/index.cjs') as typeof Core
const { default: createInstance } = load('../dist/create-instance.cjs') as {
  default: typeof createInstanceSource
}
const { createElement: h } = loadFromBinding('react') as ReactParts
const { renderToString } = loadFromBinding('react-dom/server') as {
  renderToString(element: unknown): string
}
const binding = loadFromBinding('./dist/index.cjs') as BindingParts

const small = createSmallStyle()

const plain = createInstance({ key: 'b', sheet: core.createMemorySheet() })
plain.css(small)

/** A styled `div` of the small style over a fresh cache, and its element, rendered once already. */
function createStyledElement(hasServerStyleElements: boolean) {
  const cache = core.createCache({
    prefix: 'b',
    sheet: core.createMemorySheet(),
    hasDevChecks: false,
  })
  const { styled } = binding.createStyle({}, { prefix: 'b', cache, hasServerStyleElements })
  const element = h(styled('div', { name: 'Box' })(small))
  renderToString(element)
  return element
}

const withStyleElement = createStyledElement(true)
const withoutStyleElement = createStyledElement(false)
renderToString(h('div', { className: plain.css(small) }))

export default {
  name: 'css: next to a styled component',
  cases: {
    'css package: the class name only': () => plain.css(small),
    'css package: a div with the class, to string': () =>
      renderToString(h('div', { className: plain.css(small) })),
    'styled component: to string, with its style element': () => renderToString(withStyleElement),
    'styled component: to string, no style element': () => renderToString(withoutStyleElement),
  },
} satisfies BenchConfig
