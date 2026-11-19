import {
  combineResults,
  createResult,
  formatBytes,
  formatHz,
  formatMarkdown,
  formatMargin,
  formatMean,
  formatMemory,
  formatTable,
} from './report'
import type { CaseResult, MemoryResult, PartFile } from './types'

const environment = { node: '26', vitest: '5', platform: 'win32', cpu: 'cpu', cores: 8, time: 200 }

function createCase(file: string, name: string, hz: number): CaseResult {
  return {
    id: `core/${file} > g > ${name}`,
    package: 'core',
    file,
    group: 'g',
    name,
    hz,
    mean: 1000 / hz,
    rme: 1.234,
    samples: 50,
  }
}

const memory: MemoryResult = {
  id: 'core/memory > grows',
  package: 'core',
  file: 'memory',
  name: 'grows',
  bytes: 2048,
  isForced: true,
  note: 'five thousand classes',
}

const parts: PartFile[] = [
  { package: 'core', file: 'tokens', cases: [createCase('tokens', 'one', 1000)], memory: [] },
  {
    package: 'core',
    file: 'classes',
    cases: [createCase('classes', 'two', 2000000)],
    memory: [memory],
  },
  { package: 'core', file: 'classes', cases: [], memory: [] },
]

describe('createResult and combineResults', () => {
  it('orders the files by name, and keeps the order of the cases in a file', () => {
    const result = createResult('core', parts, environment, 'now')
    expect(result.cases.map((item) => item.name)).toEqual(['two', 'one'])
    expect(result.memory).toEqual([memory])
    expect(result.package).toBe('core')
  })

  it('puts several results into one called all', () => {
    const one = createResult('core', parts, environment, 'now')
    const all = combineResults([one, one], environment, 'later')
    expect(all.package).toBe('all')
    expect(all.cases).toHaveLength(4)
    expect(all.memory).toHaveLength(2)
    expect(all.createdAt).toBe('later')
  })
})

describe('the formats', () => {
  it('writes operations per second, margins, times and sizes', () => {
    expect(formatHz(1234567.4)).toBe('1 234 567')
    expect(formatHz(999)).toBe('999')
    expect(formatHz(12.345)).toBe('12.35')
    expect(formatMargin(1.234)).toBe('+-1.23%')
    expect(formatMean(2.5)).toBe('2.50 ms')
    expect(formatMean(0.0025)).toBe('2.50 us')
    expect(formatMean(0.0000025)).toBe('2.5 ns')
    expect(formatBytes(12)).toBe('12 B')
    expect(formatBytes(-2048)).toBe('-2.0 kB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB')
  })

  it('aligns a table of cases and a table of memory figures', () => {
    const result = createResult('core', parts, environment, 'now')
    const table = formatTable(result.cases).split('\n')
    expect(table[0]).toMatch(/^case\s+ops\/s\s+margin$/)
    expect(table[1]).toContain('core/classes > g > two')
    expect(table[1]).toContain('2 000 000')
    const memoryTable = formatMemory([memory, { ...memory, isForced: false }])
    expect(memoryTable).toContain('2.0 kB')
    expect(memoryTable).toContain('no')
  })

  it('writes the Markdown report with and without memory figures', () => {
    const result = createResult('core', parts, environment, 'now')
    const text = formatMarkdown(result)
    expect(text).toContain('# Benchmark report: core')
    expect(text).toContain('| core/classes > g > two | 2 000 000 | 500.0 ns | +-1.23% | 50 |')
    expect(text).toContain('## Memory')
    expect(text).toContain('| core/memory > grows | 2.0 kB | yes | five thousand classes |')
    expect(formatMarkdown({ ...result, memory: [] })).not.toContain('## Memory')
    expect(formatMarkdown({ ...result, memory: [{ ...memory, isForced: false }] })).toContain(
      '| no |'
    )
  })
})
