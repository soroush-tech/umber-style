// What one operation is, in this file: one `resolveTree` of a provider around the tree of 500 styled
// elements (100 rows of `Flex` with four `Cell`s each), made once before the cases, with the server
// components build of the binding under the `react-server` condition, as in
// `server-elements.bench.ts`. The tree makes its elements in the render. "With a shift" moves the props
// of every element (other combinations and tones), over its own warm cache. A render before the
// measurement made the classes of each case. Each case has an engine and a cache of its own, with an
// in-memory sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import { createComponents } from './fixtures'
import { createServerStyle, fixtures, resolveTree } from './server'

const { createTreeApp } = fixtures

/** The operation for the tree with `shift`, over a fresh style object, after a render that warms the cache. */
async function prepare(shift: number): Promise<() => Promise<unknown>> {
  const style = createServerStyle()
  const element = createTreeApp(style, createComponents(style), shift)
  await resolveTree(element)
  return () => resolveTree(element)
}

export default {
  name: 'react: server components, resolve the tree of 500',
  cases: {
    'tree of 500 elements, resolved': await prepare(0),
    'tree of 500 elements, resolved with a shift': await prepare(1),
  },
} satisfies BenchConfig
