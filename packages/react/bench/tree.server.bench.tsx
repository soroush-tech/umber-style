// What one operation is, in this file: one `resolveTree` of an element made once before the cases, with
// the server components build of the binding under the `react-server` condition, the way its tests
// run it (`vitest.resolveTree.ts`: function components are called in order and may be async, and the
// result is plain data; there is no `react-dom/server` here). It leaves out what a real server render
// adds on top (serialising to HTML), so compare it with the other server numbers by shape, not by sum.
//   48 elements   a provider with 48 elements of one component, over a warm cache (a render before the
//                 measurement made the classes). The cases are the same as in `string.bench.tsx`.
//   tree          a provider around the tree of 500 styled elements, which makes its elements in the render.
// Each case has an engine and a cache of its own, with an in-memory sheet; the request's slot, which
// `React.cache` keeps in a real render, is a closure that lives as long as the case, as in the tests.
import { createEngine } from '@umber-style/core'
import { runGroup } from '@umber-bench/shared/harness'
import type { ReactElement } from 'react'
import { bindEngine } from '../src/createStyle.server'
import type { CacheFunction } from '../src/serverContext'
import { resolveTree } from '../src/vitest.resolveTree'
import {
  createBenchOptions,
  createComponents,
  createFortyEight,
  theme,
  Tree,
  type BenchStyle,
} from './fixtures'

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function createSetup() {
  const style = bindEngine(createEngine(theme, createBenchOptions()), requestCache)
  return { style: style as BenchStyle, components: createComponents(style as BenchStyle) }
}

/** The operation for an element made over a fresh setup, after a render that warms the cache. */
async function prepare(
  makeElement: (setup: ReturnType<typeof createSetup>) => ReactElement
): Promise<() => Promise<unknown>> {
  const element = makeElement(createSetup())
  await resolveTree(element)
  return () => resolveTree(element)
}

const kinds = ['fixed', 'themed', 'flex', 'override', 'entry'] as const
const labels: Record<(typeof kinds)[number], string> = {
  fixed: 'fixed styles only',
  themed: 'a function of the theme only',
  flex: 'prop-driven, 48 combinations',
  override: 'an override through style',
  entry: 'a single sheet entry in style',
}

it('server components: resolve 48 elements', async (context) => {
  const cases = await Promise.all(
    kinds.map(async (kind) => ({
      name: `48 elements, ${labels[kind]}`,
      fn: await prepare(({ style, components }) => (
        <style.ThemeProvider theme={theme}>
          {createFortyEight(components, kind)}
        </style.ThemeProvider>
      )),
    }))
  )
  await runGroup(context, '48 elements', cases)
})

it('server components: resolve the tree of 500', async (context) => {
  await runGroup(context, 'tree', [
    {
      name: 'tree of 500 elements, resolved',
      fn: await prepare(({ style, components }) => (
        <style.ThemeProvider theme={theme}>
          <Tree components={components} />
        </style.ThemeProvider>
      )),
    },
    {
      name: 'tree of 500 elements, resolved with a shift',
      fn: await prepare(({ style, components }) => (
        <style.ThemeProvider theme={theme}>
          <Tree components={components} shift={1} />
        </style.ThemeProvider>
      )),
    },
  ])
})
