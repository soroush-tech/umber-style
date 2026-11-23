// One operation: see `extractPage` in scenarios.ts (the CSS of one page of ten). `current` is this tree's build,
// `previous` the build of the last release (support.ts).
import type { BenchConfig } from '@soroush.tech/bench'
import { extractPage } from './scenarios'
import { createGate } from './support'

export default createGate(extractPage) satisfies BenchConfig
