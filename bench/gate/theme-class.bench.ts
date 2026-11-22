// One operation: see `themeClass` in scenarios.ts (a theme class of a large theme the engine has not seen). `current` is this tree's build,
// `previous` the build of the last release (support.ts).
import type { BenchConfig } from '@soroush.tech/bench'
import { themeClass } from './scenarios'
import { createGate } from './support'

export default createGate(themeClass) satisfies BenchConfig
