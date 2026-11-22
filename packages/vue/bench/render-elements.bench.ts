// What one operation is, in this file: one `renderToString` of a new server app (`createSSRApp`, whose
// render function makes its virtual nodes in the render, as a component does) with the built Vue binding
// and production Vue. The app's creation is part of the time: a server makes one for each request. The
// app is a provider with 48 elements of one component, over a warm cache (a render before the
// measurement made the classes). `flex` is the prop-driven component, one of 48 combinations for each
// element; `override` has a style object in `style` (merged into an override class), `entry` a single
// sheet entry (used directly, no merge). Each case has an engine and a cache of its own, with an
// in-memory sheet. `renderToString` of Vue is asynchronous, so each operation also pays one turn of the
// microtask queue.
import type { BenchConfig } from '@soroush.tech/bench'
import { KINDS, LABELS } from '../../../bench/src/components'
import { createFortyEight, prepare } from './fixtures'

const cases = Object.fromEntries(
  await Promise.all(
    KINDS.map(
      async (kind) =>
        [
          `48 elements, ${LABELS[kind]}`,
          await prepare((setup) => createFortyEight(setup, kind)),
        ] as const
    )
  )
)

export default {
  name: 'vue: render to string, 48 elements',
  cases,
} satisfies BenchConfig
