// One operation: see `classMissSmall` in scenarios.ts (a small style the cache has not seen). `current` is this tree's build,
// `previous` the build of the last release (support.ts).
import type { BenchConfig } from '@soroush.tech/bench'
import { classMissSmall } from './scenarios'
import { createGate } from './support'

export default createGate(classMissSmall) satisfies BenchConfig
