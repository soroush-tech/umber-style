// What one operation is, in this file: one `resolveTree` of an element made once before the cases, with
// the server components build of the binding under the `react-server` condition, the way its tests run
// it (`src/vitest.resolveTree.ts`: function components are called in order and may be async, and the
// result is plain data; there is no `react-dom/server` here). It leaves out what a real server render
// adds on top (serialising to HTML), so compare it with the other server numbers by shape, not by sum.
// The element is a provider with 48 elements of one component, over a warm cache (a render before the
// measurement made the classes). The cases are the same as in `string-elements.bench.ts`. Each case has
// an engine and a cache of its own, with an in-memory sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import { kinds, labels, type Kind } from './fixtures'
import { createServerStyle, fixtures, resolveTree } from './server'

const { createComponents, createFortyEight, provide } = fixtures

/** The operation for one kind, over a fresh style object, after a render that warms the cache. */
async function prepare(kind: Kind): Promise<() => Promise<unknown>> {
  const style = createServerStyle()
  const element = provide(style, createFortyEight(createComponents(style), kind))
  await resolveTree(element)
  return () => resolveTree(element)
}

const cases = Object.fromEntries(
  await Promise.all(
    kinds.map(async (kind) => [`48 elements, ${labels[kind]}`, await prepare(kind)] as const)
  )
)

export default {
  name: 'react: server components, resolve 48 elements',
  cases,
} satisfies BenchConfig
