// What one operation is, in this file, with the built React Native binding and production React over
// the stand-in platform module in `platform.ts` (a `StyleSheet.create` that returns its input):
//   48 elements   one `renderToString` of a provider with 48 elements of one styled component, whose
//                 base component is a stand-in view that renders an empty element with its children.
//                 This is the cost of resolving the styles of 48 elements (and of React), not of a
//                 native view. `flex` is the prop-driven component, one of 48 combinations for each
//                 element.
//   tree          the same around the tree of 500 styled elements: 100 rows of `Flex` with four `Cell`s.
// A render before the measurement made each case's styles. The platform's own cost (native view
// creation, style registration across the bridge) is not here.
import type { BenchConfig } from '@soroush.tech/bench'
import { KINDS, LABELS } from '../../../bench/src/components'
import { createFortyEight, createTree, prepare } from './fixtures'

export default {
  name: 'react native: resolve the styles of 48 elements and of the tree',
  cases: {
    ...Object.fromEntries(
      KINDS.map((kind) => [
        `48 elements, ${LABELS[kind]}`,
        prepare((setup) => createFortyEight(setup, kind)),
      ])
    ),
    'tree of 500 elements, render to a string': prepare(createTree),
  },
} satisfies BenchConfig
