// What one operation is, in this file: one `renderToString` of a new server app (`createSSRApp`, whose
// render function makes its virtual nodes in the render) with the built Vue binding and production Vue,
// over a warm cache (a render before the measurement made the classes). The app's creation is part of
// the time: a server makes one for each request.
//   tree     a provider around the tree of 500 styled elements: 100 rows of `Flex` with four `Cell`s
//            each, made in the render.
//   nested   48 themed elements inside three providers, each with its own partial theme.
// Each case has an engine and a cache of its own, with an in-memory sheet. `renderToString` of Vue is
// asynchronous, so each operation also pays one turn of the microtask queue.
import type { BenchConfig } from '@soroush.tech/bench'
import { createNested, createTree, prepare } from './fixtures'

export default {
  name: 'vue: render to string, the tree of 500',
  cases: {
    'tree of 500 elements, server render to a string': await prepare(createTree),
    'nested providers three deep, 48 themed elements': await prepare(createNested),
  },
} satisfies BenchConfig
