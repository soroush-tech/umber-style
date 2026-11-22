// What one operation is, in this file: one `compileRules('.b-x', style)` of a style object, the
// serializer alone, with no cache and no hash; and one `mergeStyles([style])` of the large style, the
// merge step a class with several sources goes through.
import type { BenchConfig } from '@soroush.tech/bench'
import { createLargeStyle, createSmallStyle } from '../../../bench/src/styles'
import type { StyleObject } from '../src/index'
import { core } from './core'

const small = createSmallStyle() as StyleObject
const large = createLargeStyle() as StyleObject

export default {
  name: 'core: style object to rules',
  cases: {
    'compile a small style object': () => core.compileRules('.b-x', small),
    'compile a large style object': () => core.compileRules('.b-x', large),
    'merge one large style object': () => core.mergeStyles([large]),
  },
} satisfies BenchConfig
