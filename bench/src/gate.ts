// The continuous-integration gate: UmberStyle's base against its head, measured in rounds on one machine,
// compared by the median of the per-case ratios. Node runs this file directly (`bin/gate.mjs`), so it
// imports types only. Everything that touches the machine (the child processes, the files) comes in
// through `GateDeps`, so the whole flow has unit tests.
import type { ResultFile } from './types'

/** Which cases are gated, and from what ratio a gated case fails. */
export interface GateConfig {
  /** A gated case's median ratio (head over base, in operations per second) below this fails the gate. */
  threshold: number
  /** Case id prefixes that are gated. */
  gated: readonly string[]
  /** Case id prefixes that are reported and not gated, taken out of `gated` (they win over it). */
  reportOnly: readonly string[]
}

export type GateStatus = 'fail' | 'slower' | 'faster' | 'same'

/** One case measured in every round, by both sides. */
export interface GateRow {
  id: string
  /** Head over base in operations per second, one per round, in round order. */
  ratios: number[]
  median: number
  low: number
  high: number
  /** How many rounds had a ratio below the threshold. */
  below: number
  isGated: boolean
  status: GateStatus
}

/** What the gate found: the rows, and the ids that only one side has. */
export interface GateReport {
  rows: GateRow[]
  rounds: number
  threshold: number
  added: string[]
  removed: string[]
}

export const DEFAULT_ROUNDS = 4

/** Whether the case `id` is gated by `config`. */
export function isGated(id: string, config: GateConfig): boolean {
  return (
    config.gated.some((prefix) => id.startsWith(prefix)) &&
    !config.reportOnly.some((prefix) => id.startsWith(prefix))
  )
}

/** The median of a non-empty list: the middle value, or the mean of the two in the middle. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** One side of one round as a map of case id to operations per second. */
function readHz(file: ResultFile): Map<string, number> {
  return new Map(file.cases.map((item) => [item.id, item.hz]))
}

/**
 * Compares the rounds: for every case that every round of both sides has, the ratio of the head to the
 * base in each round, and the median of them. A gated case fails when its median is below the threshold;
 * a case that is not gated is marked `slower` or `faster` by the same threshold and its inverse, and never fails.
 */
export function compareRounds(
  rounds: readonly { base: ResultFile; head: ResultFile }[],
  config: GateConfig
): GateReport {
  const bases = rounds.map((round) => readHz(round.base))
  const heads = rounds.map((round) => readHz(round.head))
  const inAll = (maps: readonly Map<string, number>[], id: string) => maps.every((m) => m.has(id))
  const ids = [...new Set(bases.flatMap((m) => [...m.keys()]))]
  const headIds = [...new Set(heads.flatMap((m) => [...m.keys()]))]
  const common = ids.filter((id) => inAll(bases, id) && inAll(heads, id))
  const rows = common.map((id): GateRow => {
    const ratios = rounds.map((_, index) => heads[index].get(id)! / bases[index].get(id)!)
    const middle = median(ratios)
    const isCaseGated = isGated(id, config)
    let status: GateStatus = 'same'
    if (middle < config.threshold) status = isCaseGated ? 'fail' : 'slower'
    else if (middle > 1 / config.threshold) status = 'faster'
    return {
      id,
      ratios,
      median: middle,
      low: Math.min(...ratios),
      high: Math.max(...ratios),
      below: ratios.filter((ratio) => ratio < config.threshold).length,
      isGated: isCaseGated,
      status,
    }
  })
  return {
    rows,
    rounds: rounds.length,
    threshold: config.threshold,
    added: headIds.filter((id) => !bases[0].has(id)),
    removed: ids.filter((id) => !heads[0].has(id)),
  }
}

/** A ratio as text. */
function formatRatio(ratio: number): string {
  return ratio.toFixed(2)
}

/** One row of the table: the case, its median, the range over the rounds and how many rounds were below. */
function formatRow(row: GateRow, rounds: number): string {
  const kind = row.isGated ? 'gated' : 'report only'
  const mark = row.status === 'fail' ? 'FAIL' : row.status === 'same' ? '' : row.status
  return `| ${row.id} | ${kind} | ${formatRatio(row.median)} | ${formatRatio(row.low)} to ${formatRatio(row.high)} | ${row.below}/${rounds} | ${mark} |`
}

const TABLE_HEAD = [
  '| case | kind | median ratio | range over rounds | rounds below | |',
  '| --- | --- | ---: | ---: | ---: | --- |',
]

/**
 * The report as Markdown, for the job summary and the terminal: the verdict, the cases that failed or
 * moved (a failure with most rounds below the threshold is a regression; one with a median just under it, a wide
 * range and few rounds below is probably noise), and every case in a collapsed table.
 */
export function formatGate(report: GateReport): string {
  const { rows, rounds, threshold } = report
  const gated = rows.filter((row) => row.isGated)
  const failed = rows.filter((row) => row.status === 'fail')
  const moved = rows.filter((row) => row.status === 'slower' || row.status === 'faster')
  const lines = [
    '## Benchmark gate',
    '',
    `Head against base, ${rounds} interleaved rounds, the median of the per-case ratios (operations per second, head over base; below 1 is slower). A gated case fails below ${threshold}.`,
    '',
    failed.length === 0
      ? `Passed: ${gated.length} gated cases, none below ${threshold}; ${rows.length - gated.length} cases are report only.`
      : `FAILED: ${failed.length} of ${gated.length} gated cases are below ${threshold}.`,
    '',
  ]
  const table = (list: readonly GateRow[]) => [
    ...TABLE_HEAD,
    ...list.map((row) => formatRow(row, rounds)),
  ]
  if (failed.length > 0) {
    lines.push(
      '### Failed',
      '',
      ...table(failed),
      '',
      'Most rounds below the threshold: a regression. A median just under it, with few rounds below and a wide range: probably noise, run the gate again.',
      ''
    )
  }
  if (moved.length > 0) {
    lines.push('### Moved, not gated or beyond the failures', '', ...table(moved), '')
  }
  if (report.added.length + report.removed.length > 0) {
    lines.push(
      `Only in the head (${report.added.length}), only in the base (${report.removed.length}): not compared.`,
      ''
    )
  }
  lines.push('<details><summary>Every case</summary>', '', ...table(rows), '', '</details>')
  return lines.join('\n')
}

/** What the gate needs from the machine. */
export interface GateDeps {
  /** Whether the checkout at `dir` has a benchmark suite to run. */
  hasSuite: (dir: string) => boolean
  /** Runs the suite of the checkout at `dir`, its results into `outDir`; the exit status. */
  runSuite: (dir: string, outDir: string) => number
  readResult: (path: string) => ResultFile
  writeText: (path: string, text: string) => void
  write: (line: string) => void
}

const USAGE =
  'Use: bench:gate --base <dir> --head <dir> [--rounds n] [--threshold x] [--out dir]  (defaults: 4 rounds, bench/results/gate)'

/** The value after `flag` in `argv`, if there is one. */
function readFlag(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  return index === -1 ? undefined : argv[index + 1]
}

/** A positive number from text, else undefined. */
function readPositive(text: string | undefined): number | undefined {
  const value = Number(text)
  return text !== undefined && Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * The command. Measures `--base` and `--head` in rounds, one after the other and alternating which goes
 * first, then writes and prints the report. The exit code is 1 when a gated case fails, 2 for a wrong call
 * or a suite that failed to run, else 0. A base with no suite (before the suite was added) passes with a notice.
 */
export function runGate(
  argv: readonly string[],
  config: GateConfig,
  defaultOut: string,
  deps: GateDeps
): number {
  const args = argv.filter((value) => value !== '--')
  const base = readFlag(args, '--base')
  const head = readFlag(args, '--head')
  const rounds =
    readFlag(args, '--rounds') === undefined
      ? DEFAULT_ROUNDS
      : readPositive(readFlag(args, '--rounds'))
  const threshold =
    readFlag(args, '--threshold') === undefined
      ? config.threshold
      : readPositive(readFlag(args, '--threshold'))
  const out = readFlag(args, '--out') ?? defaultOut
  if (
    !base ||
    !head ||
    rounds === undefined ||
    threshold === undefined ||
    !Number.isInteger(rounds)
  ) {
    deps.write(USAGE)
    return 2
  }
  if (!deps.hasSuite(base)) {
    deps.write(
      `::notice title=Benchmark gate::The base (${base}) has no benchmark suite, so there is nothing to compare against. The gate passes.`
    )
    return 0
  }
  const results: { base: ResultFile; head: ResultFile }[] = []
  for (let round = 0; round < rounds; round++) {
    const order = round % 2 === 0 ? ['base', 'head'] : ['head', 'base']
    const dirs = { base, head }
    const files: Partial<Record<'base' | 'head', ResultFile>> = {}
    for (const side of order as ('base' | 'head')[]) {
      const outDir = `${out}/round-${round + 1}-${side}`
      deps.write(`\n=== round ${round + 1} of ${rounds}: ${side} ===`)
      if (deps.runSuite(dirs[side], outDir) !== 0) {
        deps.write(`The benchmark suite of the ${side} failed to run: see the output above.`)
        return 2
      }
      files[side] = deps.readResult(`${outDir}/all.json`)
    }
    results.push({ base: files.base!, head: files.head! })
  }
  const report = compareRounds(results, { ...config, threshold })
  const text = formatGate(report)
  deps.writeText(`${out}/gate.md`, text)
  deps.write(`\n${text}`)
  return report.rows.some((row) => row.status === 'fail') ? 1 : 0
}
