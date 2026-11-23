// One operation: see `classMissLarge` in scenarios.ts (a large style the cache has not seen). `current` is this tree's build,
// `previous` the build of the last release (support.ts).
import type { BenchConfig } from '@soroush.tech/bench'
import { classMissLarge } from './scenarios'
import { createGate } from './support'

export default createGate(classMissLarge) satisfies BenchConfig
