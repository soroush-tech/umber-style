import { planReport } from './releases'
import {
  createColumns,
  createReportRow,
  formatReport,
  formatTime,
  type BenchJson,
} from './reportTable'

/** The JSON of one file with these mean times (nanoseconds), by version. */
const createJson = (times: Record<string, number>): BenchJson => ({
  name: 'core: the same style again',
  cases: Object.entries(times).map(([key, avg]) => ({
    label: `core: the same style again :: ${key}`,
    key,
    avg,
    p75: avg,
    alloc: 1000,
  })),
})

describe('formatTime', () => {
  it('writes a time as the table of soroush-bench does, with us for microseconds', () => {
    expect(formatTime(640.4)).toBe('640 ns')
    expect(formatTime(2030)).toBe('2.03 us')
    expect(formatTime(1_430_000)).toBe('1.43 ms')
  })
})

describe('createColumns', () => {
  it('puts the versions compared first and the published one last, against the baseline', () => {
    const columns = createColumns(planReport(['0.1.0', '0.2.0-alpha.0'], '0.2.0-alpha.1'))
    expect(columns).toEqual({
      baseline: '0.1.0',
      versions: [
        { version: '0.1.0', role: 'last stable' },
        { version: '0.2.0-alpha.0', role: 'previous alpha' },
        { version: '0.2.0-alpha.1', role: 'published' },
      ],
    })
  })

  it('has none for a first release', () => {
    expect(createColumns(planReport([], '0.1.0'))).toBeUndefined()
  })
})

describe('createReportRow', () => {
  const columns = createColumns(planReport(['0.1.0', '0.2.0-alpha.0'], '0.2.0-alpha.1'))!

  it('gives each version its time, and the others their speed against the baseline', () => {
    const json = createJson({ '0.1.0': 2030, '0.2.0-alpha.0': 2350, '0.2.0-alpha.1': 2220 })
    expect(createReportRow(json, columns)).toEqual({
      name: 'core: the same style again',
      cells: ['2.03 us', '2.35 us (86.4%)', '2.22 us (91.4%)'],
    })
  })

  it('has no row when a version, the baseline too, has no case', () => {
    expect(createReportRow(createJson({ '0.1.0': 1, '0.2.0-alpha.1': 1 }), columns)).toBeUndefined()
    expect(
      createReportRow(createJson({ '0.2.0-alpha.0': 1, '0.2.0-alpha.1': 1 }), columns)
    ).toBeUndefined()
  })
})

describe('formatReport', () => {
  it('writes a title, what a cell is, and one row for each file', () => {
    const columns = createColumns(planReport(['0.1.0'], '0.2.0'))!
    const text = formatReport(
      '@umber-style/core@0.2.0',
      columns,
      [{ name: 'core: the same style again', cells: ['2.03 us', '2.22 us (91.4%)'] }],
      '5'
    )
    expect(text.split('\n')).toEqual([
      '### Benchmarks: `@umber-style/core@0.2.0`',
      '',
      'Each row is one scenario of `bench/report/`, the median of 5 rounds in the soroush-bench sandbox (one CPU, 512 MB), every version installed from npm. A cell is the mean time of one operation and, in brackets, the speed against 0.1.0: above 100% is faster.',
      '',
      '| Scenario | 0.1.0 (last stable) | 0.2.0 (published) |',
      '| --- | ---: | ---: |',
      '| core: the same style again | 2.03 us | 2.22 us (91.4%) |',
    ])
  })
})
