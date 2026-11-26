// The table of the report after a release, made from what soroush-bench writes with `--json-file`: pure
// functions of that JSON and of the plan of `planReport`, so that `scripts/bench-report.mjs`, which runs
// Docker and reads the registry, keeps no rule of its own.
import type { ReportPlan } from './releases'

/** One case of the JSON that soroush-bench writes with `--json-file`: raw numbers, nanoseconds and bytes. */
export interface BenchJsonCase {
  /** `<name of the config> :: <key>`. */
  label: string
  /** The case key: here, a version. */
  key: string
  /** The mean time of one operation, in nanoseconds (with `--rounds`, the median of the rounds). */
  avg: number
  p75: number
  alloc?: number
}

/** What soroush-bench writes with `--json-file`: the name of the file's config and its cases. */
export interface BenchJson {
  name: string
  cases: BenchJsonCase[]
}

/** The versions of a report, the baseline among them: what `scripts/bench-report.mjs` makes from a `ReportPlan`. */
export interface ReportColumns {
  /** The version every ratio is against. */
  baseline: string
  /** The versions compared, oldest first, then the one just published, each with why it is there. */
  versions: { version: string; role: string }[]
}

/** One row of the table: the scenario (the name of the file's config) and one cell for each version. */
export interface ReportRow {
  name: string
  cells: string[]
}

/** A time as the table of soroush-bench writes it (`2.03 us`, `1.43 ms`, `640 ns`), with `us` for microseconds. */
export function formatTime(nanoseconds: number): string {
  if (nanoseconds >= 1e6) return `${(nanoseconds / 1e6).toFixed(2)} ms`
  if (nanoseconds >= 1e3) return `${(nanoseconds / 1e3).toFixed(2)} us`
  return `${nanoseconds.toFixed(0)} ns`
}

/** The columns of the report of `plan`: the versions compared, then the published one. Undefined with no baseline. */
export function createColumns(plan: ReportPlan): ReportColumns | undefined {
  if (plan.baseline === undefined) return undefined
  return {
    baseline: plan.baseline,
    versions: [...plan.compared, { version: plan.published, role: 'published' }],
  }
}

/**
 * The row of one file of the report: for each version its mean time, and for every version but the
 * baseline the speed against it in brackets, `baseline.avg / version.avg` as a percent (the ratio the
 * gate of soroush-bench checks: above 100% is faster). Undefined when a version has no case in `json`.
 */
export function createReportRow(json: BenchJson, columns: ReportColumns): ReportRow | undefined {
  const byVersion = new Map(json.cases.map((item) => [item.key, item.avg]))
  const base = byVersion.get(columns.baseline)
  if (base === undefined) return undefined
  const cells = columns.versions.map(({ version }) => {
    const time = byVersion.get(version)
    if (time === undefined) return undefined
    if (version === columns.baseline) return formatTime(time)
    return `${formatTime(time)} (${((base / time) * 100).toFixed(1)}%)`
  })
  if (cells.includes(undefined)) return undefined
  return { name: json.name, cells: cells as string[] }
}

/** The markdown of the report of `spec` (`<name>@<version>`): a title, what a cell is, and one row for each file. */
export function formatReport(
  spec: string,
  columns: ReportColumns,
  rows: readonly ReportRow[],
  rounds: string
): string {
  const head = columns.versions.map(({ version, role }) => `${version} (${role})`)
  return [
    `### Benchmarks: \`${spec}\``,
    '',
    `Each row is one scenario of \`bench/report/\`, the median of ${rounds} rounds in the soroush-bench sandbox (one CPU, 512 MB), every version installed from npm. A cell is the mean time of one operation and, in brackets, the speed against ${columns.baseline}: above 100% is faster.`,
    '',
    `| Scenario | ${head.join(' | ')} |`,
    `| --- | ${head.map(() => '---:').join(' | ')} |`,
    ...rows.map(({ name, cells }) => `| ${name} | ${cells.join(' | ')} |`),
  ].join('\n')
}
