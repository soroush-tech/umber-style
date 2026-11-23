// One operation: see `classMerge` in scenarios.ts (merging five classes). `current` is this tree's build,
// `previous` the build of the last release (support.ts).
import type { BenchConfig } from '@soroush.tech/bench'
import { classMerge } from './scenarios'
import { createGate } from './support'

export default createGate(classMerge) satisfies BenchConfig
