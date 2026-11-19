// The part of a benchmark file that is the same in all of them: it registers the cases of a group
// through the runner's `bench`, runs them one after the other, and writes what it measured.
//
// The form that works in vitest 5.1: `bench` is not an export of `vitest`. A benchmark is a test (`it`)
// in a `*.bench.ts(x)` file, run by `vitest bench`, and it takes `bench` from its test context:
// `it('group', async (context) => { await runGroup(context, 'group', cases) })`. `context.bench(name,
// options, fn)` registers a case and `context.bench.compare(...)` runs the registered ones and prints
// one table. Each group is one test.
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestContext } from 'vitest'
import type { CaseResult, MemoryResult, PartFile } from './types'

/** One case of a group. */
export interface BenchCase {
  name: string
  /** One operation. What it does is the comment at the top of the file. */
  fn: () => unknown
  /** Runs before each operation and is not timed: for state that an operation would otherwise leave behind. */
  beforeEach?: () => void | Promise<void>
  /** Runs after each operation and is not timed. */
  afterEach?: () => void | Promise<void>
}

/** Milliseconds each case is measured for: `BENCH_TIME`, 200 by default. A longer time gives a steadier figure. */
export const BENCH_TIME = Number(process.env.BENCH_TIME ?? 200)
/** Milliseconds of warm-up before a case is measured: `BENCH_WARMUP`, a quarter of the time by default. */
export const BENCH_WARMUP = Number(process.env.BENCH_WARMUP ?? Math.round(BENCH_TIME / 4))

const parts = new Map<string, PartFile>()

/** The package folder this run is in: `BENCH_PACKAGE`, else the folder the runner was started in. */
function readPackage(): string {
  return process.env.BENCH_PACKAGE ?? basename(process.cwd())
}

/** The name of a benchmark file without its folder and its `.bench.ts(x)`. */
function readFileLabel(context: TestContext): string {
  return basename(context.task.file.filepath).replace(/\.bench\.tsx?$/, '')
}

/** Writes what one file has measured so far, to the folder the runner reads. */
function writePart(part: PartFile): void {
  const folder =
    process.env.BENCH_PARTS_DIR ?? fileURLToPath(new URL('../results/parts', import.meta.url))
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, `${part.package}--${part.file}.json`), JSON.stringify(part, null, 2))
}

/** The part of the file of `context`, made on first use. */
function getPart(context: TestContext): PartFile {
  const file = readFileLabel(context)
  const pkg = readPackage()
  const key = `${pkg}/${file}`
  let part = parts.get(key)
  if (part === undefined) {
    part = { package: pkg, file, cases: [], memory: [] }
    parts.set(key, part)
  }
  return part
}

/**
 * Runs the cases of one group in order and records them. Names in a group are unique. `timeFactor`
 * multiplies the time each case is measured for, for a group whose cases are slow or whose figures are
 * close together.
 */
export async function runGroup(
  context: TestContext,
  group: string,
  cases: readonly BenchCase[],
  timeFactor = 1
): Promise<void> {
  const { bench } = context
  const part = getPart(context)
  const registrations = cases.map(({ name, fn, beforeEach, afterEach }) =>
    bench(name, { beforeEach, afterEach }, fn)
  )
  const options = {
    time: BENCH_TIME * timeFactor,
    warmupTime: BENCH_WARMUP * timeFactor,
    // Few minimum samples and warm-ups: a slow operation must not take seconds. The time decides.
    iterations: 8,
    warmupIterations: 2,
  }
  // `compare` takes two cases or more; a group of one is run on its own.
  const results =
    registrations.length === 1
      ? { get: () => registrations[0].run(options) }
      : await bench.compare(...registrations, options)
  for (const { name } of cases) {
    const { latency } = await results.get(name)
    const result: CaseResult = {
      id: `${part.package}/${part.file} > ${group} > ${name}`,
      package: part.package,
      file: part.file,
      group,
      name,
      hz: 1000 / latency.mean,
      mean: latency.mean,
      rme: latency.rme,
      samples: latency.samplesCount,
    }
    part.cases.push(result)
  }
  writePart(part)
}

/** The growth of the heap, in bytes, while `run` does its work and the result it returns is kept alive. */
export function measureHeap(run: () => unknown): { bytes: number; isForced: boolean } {
  const collect = (globalThis as { gc?: () => void }).gc
  collect?.()
  const before = process.memoryUsage().heapUsed
  const kept = run()
  collect?.()
  const after = process.memoryUsage().heapUsed
  // Reading `kept` after the second collection keeps it reachable until then.
  void kept
  return { bytes: after - before, isForced: collect !== undefined }
}

/** Records a memory figure for the file of `context`. It is reported, never compared. */
export function recordMemory(
  context: TestContext,
  name: string,
  note: string,
  measured: { bytes: number; isForced: boolean }
): void {
  const part = getPart(context)
  const memory: MemoryResult = {
    id: `${part.package}/${part.file} > ${name}`,
    package: part.package,
    file: part.file,
    name,
    note,
    ...measured,
  }
  part.memory.push(memory)
  writePart(part)
}
