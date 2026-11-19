// One operation: `createTokens(theme)` of the large theme (about 280 tokens) and `declare(theme)`, the
// variable declarations of it. Same work as core/tokens.bench.ts.
import type { BenchConfig } from '@soroush.tech/bench'
import * as local from '../../packages/core/dist/index.cjs'
import { createLargeTheme } from '../src/themes'
import { previousCore } from './baseline'
import { createSides } from './support'

export default {
  name: 'core: a theme and its variables',
  packages: { previous: previousCore },
  cases: createSides(local, (core) => {
    const theme = createLargeTheme()
    return () => core.createTokens(theme, { prefix: 'b' }).declare(theme)
  }),
} satisfies BenchConfig
