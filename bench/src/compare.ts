// Compares two result files case by case. It is what the later continuous-integration gate runs.
// Node runs this file directly (`bin/compare.mjs`), so it imports types only.
import type { ResultFile } from './types'

/** How a case changed from the first run to the second. */
export type Status = 'slower' | 'faster' | 'same' | 'added' | 'removed'

/** One case in both runs, or in one of them. */
export interface Comparison {
  id: string
  /** Operations per second in the first run, when it has the case. */
  before?: number
  /** Operations per second in the second run, when it has the case. */
  after?: number
  /** `after / before`: below 1 the case got slower. */
  ratio?: number
  status: Status
}

export const DEFAULT_LOWER = 0.8
export const DEFAULT_UPPER = 1.25

/** Every case of `first` and `second` by id: the ratio of operations per second, and whether it is beyond a threshold. */
export function compareResults(
  first: ResultFile,
  second: ResultFile,
  lower = DEFAULT_LOWER,
  upper = DEFAULT_UPPER
): Comparison[] {
  const before = new Map(first.cases.map((item) => [item.id, item.hz]))
  const after = new Map(second.cases.map((item) => [item.id, item.hz]))
  const ids = [...new Set([...before.keys(), ...after.keys()])]
  return ids.map((id) => {
    const a = before.get(id)
    const b = after.get(id)
    if (a === undefined) return { id, after: b, status: 'added' }
    if (b === undefined) return { id, before: a, status: 'removed' }
    const ratio = b / a
    const status = ratio < lower ? 'slower' : ratio > upper ? 'faster' : 'same'
    return { id, before: a, after: b, ratio, status }
  })
}

/** The comparison as lines of text: every case with its ratio, the flagged ones marked, and a summary. */
export function formatComparison(
  rows: readonly Comparison[],
  lower: number,
  upper: number
): string {
  const marks: Record<Status, string> = {
    slower: 'SLOWER',
    faster: 'faster',
    same: '',
    added: 'added',
    removed: 'removed',
  }
  const text = rows.map((row) => {
    const ratio = row.ratio === undefined ? '-' : row.ratio.toFixed(2)
    return `${row.id}  ratio ${ratio}  ${marks[row.status]}`.trimEnd()
  })
  const count = (status: Status) => rows.filter((row) => row.status === status).length
  return [
    ...text,
    '',
    `${rows.length} cases: ${count('slower')} slower than ${lower}, ${count('faster')} faster than ${upper}, ${count('added')} added, ${count('removed')} removed.`,
  ].join('\n')
}

/** Reads a threshold argument: a positive number, else undefined. */
function readThreshold(text: string): number | undefined {
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

const USAGE = 'Use: bench:compare <a.json> <b.json> [lower [upper]]  (defaults 0.8 and 1.25)'

/**
 * The command: `<a.json> <b.json> [lower [upper]]`. Prints the comparison with `write` and returns the
 * exit code: 1 when a case ran below `lower` times its speed in the first file, 2 for a wrong call, else 0.
 */
export function runCompare(
  argv: readonly string[],
  read: (path: string) => string,
  write: (line: string) => void
): number {
  const [firstPath, secondPath, lowerText, upperText] = argv.filter((value) => value !== '--')
  const lower = lowerText === undefined ? DEFAULT_LOWER : readThreshold(lowerText)
  const upper = upperText === undefined ? DEFAULT_UPPER : readThreshold(upperText)
  if (!firstPath || !secondPath || lower === undefined || upper === undefined || lower >= upper) {
    write(USAGE)
    return 2
  }
  const rows = compareResults(
    JSON.parse(read(firstPath)) as ResultFile,
    JSON.parse(read(secondPath)) as ResultFile,
    lower,
    upper
  )
  write(formatComparison(rows, lower, upper))
  return rows.some((row) => row.status === 'slower') ? 1 : 0
}
