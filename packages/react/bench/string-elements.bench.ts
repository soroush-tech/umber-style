// What one operation is, in this file: one `renderToString` of an element made once before the cases,
// with the client build of the binding and production React (so, where there is no `document`, the
// style elements of each class are rendered too, as a classic server render of a client component
// does). The element is a provider with 48 elements of one component. The engine is warm: the classes
// were made by a render before the measurement, so this is the cost of resolving and rendering over a
// cache that hits. `flex` is the prop-driven component, one of 48 combinations for each element;
// `override` has a style object in `style` (merged into an override class), `entry` a single sheet
// entry (used directly, no merge). Each case has an engine and a cache of its own, with an in-memory
// sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import { binding, fixtures, renderToString } from './client'
import { kinds, labels, type Kind } from '../../../bench/src/components'
import { createComponents, theme } from './fixtures'

const { createBenchOptions, createFortyEight, provide } = fixtures

/** The operation for one kind: a fresh style object, its components, and a cache made warm. */
function prepare(kind: Kind): () => string {
  const style = binding.createStyle(theme, createBenchOptions())
  const element = provide(style, createFortyEight(createComponents(style), kind))
  renderToString(element)
  return () => renderToString(element)
}

export default {
  name: 'react: render to string, 48 elements',
  cases: Object.fromEntries(kinds.map((kind) => [`48 elements, ${labels[kind]}`, prepare(kind)])),
} satisfies BenchConfig
