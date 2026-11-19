// Turns what the benchmark files wrote into a result file, a table for the terminal and a Markdown
// report. Node runs this file directly (`bin/run.mjs`), so it imports types only.
import type { CaseResult, Environment, MemoryResult, PartFile, ResultFile } from './types'

/** The result of one package from the files its benchmarks wrote: files in name order, cases in the order they ran. */
export function createResult(
  pkg: string,
  parts: readonly PartFile[],
  environment: Environment,
  createdAt: string
): ResultFile {
  const sorted = [...parts].sort((a, b) => a.file.localeCompare(b.file))
  return {
    package: pkg,
    createdAt,
    environment,
    cases: sorted.flatMap((part) => part.cases),
    memory: sorted.flatMap((part) => part.memory),
  }
}

/** The result of several packages as one, named `all`. */
export function combineResults(
  results: readonly ResultFile[],
  environment: Environment,
  createdAt: string
): ResultFile {
  return {
    package: 'all',
    createdAt,
    environment,
    cases: results.flatMap((result) => result.cases),
    memory: results.flatMap((result) => result.memory),
  }
}

/** Operations per second as text: whole numbers with a space between thousands, two decimals under 100. */
export function formatHz(hz: number): string {
  if (hz < 100) return hz.toFixed(2)
  return Math.round(hz)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** The relative margin of error as text. */
export function formatMargin(rme: number): string {
  return `+-${rme.toFixed(2)}%`
}

/** A time in milliseconds as text, in the unit that reads best. */
export function formatMean(milliseconds: number): string {
  if (milliseconds >= 1) return `${milliseconds.toFixed(2)} ms`
  if (milliseconds >= 0.001) return `${(milliseconds * 1000).toFixed(2)} us`
  return `${(milliseconds * 1_000_000).toFixed(1)} ns`
}

/** A number of bytes as text, with a sign. */
export function formatBytes(bytes: number): string {
  const sign = bytes < 0 ? '-' : ''
  const size = Math.abs(bytes)
  if (size >= 1024 * 1024) return `${sign}${(size / (1024 * 1024)).toFixed(2)} MB`
  if (size >= 1024) return `${sign}${(size / 1024).toFixed(1)} kB`
  return `${sign}${size} B`
}

/** Rows as aligned columns: the first left, the others right. */
function alignColumns(rows: readonly (readonly string[])[]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)))
  return rows
    .map((row) =>
      row
        .map((cell, column) =>
          column === 0 ? cell.padEnd(widths[0]) : cell.padStart(widths[column])
        )
        .join('  ')
        .trimEnd()
    )
    .join('\n')
}

/** One table of every case: its id, operations per second and margin of error. */
export function formatTable(cases: readonly CaseResult[]): string {
  const rows = [
    ['case', 'ops/s', 'margin'],
    ...cases.map((item) => [item.id, formatHz(item.hz), formatMargin(item.rme)]),
  ]
  return alignColumns(rows)
}

/** The memory figures as lines of text. */
export function formatMemory(memory: readonly MemoryResult[]): string {
  const rows = [
    ['figure', 'heap growth', 'collected'],
    ...memory.map((item) => [item.id, formatBytes(item.bytes), item.isForced ? 'yes' : 'no']),
  ]
  return alignColumns(rows)
}

/** The Markdown report of a result: where it was made, a table of the cases and the memory figures. */
export function formatMarkdown(result: ResultFile): string {
  const { environment } = result
  const lines = [
    `# Benchmark report: ${result.package}`,
    '',
    `Made ${result.createdAt} on ${environment.platform} with Node ${environment.node} and vitest ${environment.vitest}.`,
    `CPU: ${environment.cpu} (${environment.cores} cores). Each case was measured for ${environment.time} ms.`,
    '',
    '| Case | ops/s | Mean | Margin | Samples |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...result.cases.map(
      (item) =>
        `| ${item.id} | ${formatHz(item.hz)} | ${formatMean(item.mean)} | ${formatMargin(item.rme)} | ${item.samples} |`
    ),
  ]
  if (result.memory.length > 0) {
    lines.push(
      '',
      '## Memory',
      '',
      '| Figure | Heap growth | Collection forced | What was done |',
      '| --- | ---: | :---: | --- |',
      ...result.memory.map(
        (item) =>
          `| ${item.id} | ${formatBytes(item.bytes)} | ${item.isForced ? 'yes' : 'no'} | ${item.note} |`
      )
    )
  }
  return `${lines.join('\n')}\n`
}
