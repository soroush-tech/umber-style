import { compareResults, formatComparison, runCompare } from './compare'
import type { CaseResult, ResultFile } from './types'

const environment = { node: '26', vitest: '5', platform: 'test', cpu: 'cpu', cores: 1, time: 100 }

function createCase(id: string, hz: number): CaseResult {
  return {
    id,
    package: 'p',
    file: 'f',
    group: 'g',
    name: id,
    hz,
    mean: 1000 / hz,
    rme: 1,
    samples: 10,
  }
}

function createFile(...cases: CaseResult[]): ResultFile {
  return { package: 'p', createdAt: 'now', environment, cases, memory: [] }
}

const first = createFile(
  createCase('a', 100),
  createCase('b', 100),
  createCase('c', 100),
  createCase('d', 100)
)
const second = createFile(
  createCase('a', 100),
  createCase('b', 70),
  createCase('c', 150),
  createCase('e', 1)
)

describe('compareResults', () => {
  it('gives the ratio of the second to the first and flags what is beyond a threshold', () => {
    const rows = compareResults(first, second)
    expect(rows.map(({ id, ratio, status }) => [id, ratio, status])).toEqual([
      ['a', 1, 'same'],
      ['b', 0.7, 'slower'],
      ['c', 1.5, 'faster'],
      ['d', undefined, 'removed'],
      ['e', undefined, 'added'],
    ])
  })

  it('takes the thresholds it is given, and a ratio on a threshold is not flagged', () => {
    const rows = compareResults(first, second, 0.5, 1.5)
    expect(rows.map((row) => row.status)).toEqual(['same', 'same', 'same', 'removed', 'added'])
  })
})

describe('formatComparison', () => {
  it('marks the flagged cases and counts them', () => {
    const text = formatComparison(compareResults(first, second), 0.8, 1.25)
    expect(text).toContain('b  ratio 0.70  SLOWER')
    expect(text).toContain('c  ratio 1.50  faster')
    expect(text).toContain('a  ratio 1.00\n')
    expect(text).toContain('d  ratio -  removed')
    expect(text).toContain('5 cases: 1 slower than 0.8, 1 faster than 1.25, 1 added, 1 removed.')
  })
})

describe('runCompare', () => {
  const files: Record<string, ResultFile> = { 'a.json': first, 'b.json': second }
  const read = (path: string) => JSON.stringify(files[path])

  function run(...argv: string[]) {
    const lines: string[] = []
    const code = runCompare(argv, read, (line) => lines.push(line))
    return { code, text: lines.join('\n') }
  }

  it('exits 1 when a case is below the lower threshold', () => {
    const { code, text } = run('a.json', 'b.json')
    expect(code).toBe(1)
    expect(text).toContain('SLOWER')
  })

  it('exits 0 when none is, and ignores a leading --', () => {
    expect(run('--', 'a.json', 'a.json').code).toBe(0)
    expect(run('a.json', 'b.json', '0.5').code).toBe(0)
  })

  it('takes the upper threshold as the fourth argument', () => {
    expect(run('a.json', 'b.json', '0.5', '1.2').text).toContain('1 faster than 1.2')
  })

  it('exits 2 with the usage for a wrong call', () => {
    const wrong = [
      [],
      ['a.json'],
      ['a.json', 'b.json', 'x'],
      ['a.json', 'b.json', '0.8', '0'],
      ['a.json', 'b.json', '1.3', '1.2'],
    ]
    for (const argv of wrong) {
      const { code, text } = run(...argv)
      expect(code).toBe(2)
      expect(text).toContain('Use: bench:compare')
    }
  })
})
