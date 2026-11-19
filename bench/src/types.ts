// The shape of the result files. Only types, so that the scripts that node runs directly can import
// them with `import type`, which node erases.

/** One measured case. */
export interface CaseResult {
  /** `<package>/<file> > <group> > <case>`: what two runs are matched by. */
  id: string
  package: string
  file: string
  group: string
  name: string
  /** Operations per second: `1000 / mean`. */
  hz: number
  /** The mean time of one operation, in milliseconds. */
  mean: number
  /** The relative margin of error of the mean, in percent (95% confidence). */
  rme: number
  /** How many samples the statistics are made of. */
  samples: number
}

/** A figure that is reported and never compared: the heap after a piece of work. */
export interface MemoryResult {
  id: string
  package: string
  file: string
  name: string
  /** The growth of the heap, in bytes. */
  bytes: number
  /** Whether a collection was forced before and after (`--expose-gc`); without it the figure is indicative. */
  isForced: boolean
  /** What was done, in a few words. */
  note: string
}

/** What one benchmark file writes. */
export interface PartFile {
  package: string
  file: string
  cases: CaseResult[]
  memory: MemoryResult[]
}

/** Where and how a run was made. */
export interface Environment {
  node: string
  vitest: string
  platform: string
  cpu: string
  cores: number
  /** Milliseconds each case was measured for (`BENCH_TIME`). */
  time: number
}

/** What a run of one package, or of all, writes. */
export interface ResultFile {
  /** A package folder name, or `all`. */
  package: string
  createdAt: string
  environment: Environment
  cases: CaseResult[]
  memory: MemoryResult[]
}
