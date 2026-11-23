// One operation: see `classHit` in scenarios.ts (the same small style again). `current` is this tree's build,
// `previous` the build of the last release (support.ts).
import type { BenchConfig } from '@soroush.tech/bench'
import { classHit } from './scenarios'
import { createGate } from './support'

export default createGate(classHit) satisfies BenchConfig
