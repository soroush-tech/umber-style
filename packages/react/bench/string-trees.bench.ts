// What one operation is, in this file: one `renderToString` of an element made once before the cases,
// with the client build of the binding and production React, over a cache that a render before the
// measurement made warm.
//   nested   48 themed elements inside three providers, each with its own partial theme.
//   tree     a provider around the tree of 500 styled elements, which makes its elements in the render
//            (a row and four cells, 100 times). "Without style elements" turns off
//            `hasServerStyleElements`, so no style element is rendered next to a class.
// Each case has an engine and a cache of its own, with an in-memory sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import { binding, fixtures, renderToString } from './client'
import { createComponents, otherTheme, theme } from './fixtures'

const { createBenchOptions, createFortyEight, provide, createTreeApp } = fixtures

/** A fresh style object and its components. */
function createSetup(hasServerStyleElements = true) {
  const style = binding.createStyle(theme, { ...createBenchOptions(), hasServerStyleElements })
  return { style, components: createComponents(style) }
}

/** The operation for `element`, after one render that makes the cache warm. */
function prepare(element: ReturnType<typeof provide>): () => string {
  renderToString(element)
  return () => renderToString(element)
}

const nested = createSetup()
const tree = createSetup(true)
const bare = createSetup(false)

export default {
  name: 'react: render to string, nested providers and trees',
  cases: {
    'nested providers three deep, 48 themed elements': prepare(
      provide(
        nested.style,
        provide(
          nested.style,
          provide(nested.style, createFortyEight(nested.components, 'themed'), {
            palette: { primary: '#123456' },
          }),
          otherTheme
        )
      )
    ),
    'tree of 500 elements, server render to a string': prepare(
      createTreeApp(tree.style, tree.components)
    ),
    'tree of 500 elements, server render without style elements': prepare(
      createTreeApp(bare.style, bare.components)
    ),
  },
} satisfies BenchConfig
