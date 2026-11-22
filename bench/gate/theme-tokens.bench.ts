// One operation: see `themeTokens` in scenarios.ts (the tokens and declarations of the large theme). `current` is this tree's build,
// `previous` the build of the last release (support.ts).
import type { BenchConfig } from '@soroush.tech/bench'
import { themeTokens } from './scenarios'
import { createGate } from './support'

export default createGate(themeTokens) satisfies BenchConfig
