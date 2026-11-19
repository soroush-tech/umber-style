import { compareRounds, formatGate, isGated, median, runGate } from './gate'
import type { GateConfig, GateDeps } from './gate'
import type { CaseResult, ResultFile } from './types'

const environment = { node: '26', vitest: '5', platform: 'test', cpu: 'cpu', cores: 1, time: 100 }
const config: GateConfig = {
  threshold: 0.8,
  gated: ['core/', 'react/'],
  reportOnly: ['core/noisy'],
}

function createFile(hz: Record<string, number>): ResultFile {
  const cases: CaseResult[] = Object.entries(hz).map(([id, value]) => ({
    id,
    package: 'p',
    file: 'f',
    group: 'g',
    name: id,
    hz: value,
    mean: 1000 / value,
    rme: 1,
    samples: 10,
  }))
  return { package: 'all', createdAt: 'now', environment, cases, memory: [] }
}

describe('median', () => {
  it('is the middle value, or the mean of the two in the middle', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([7])).toBe(7)
  })
})

describe('isGated', () => {
  it('gates the prefixes and lets a report-only prefix win over them', () => {
    expect(isGated('core/classes > a > b', config)).toBe(true)
    expect(isGated('react/string > a > b', config)).toBe(true)
    expect(isGated('vue/render > a > b', config)).toBe(false)
    expect(isGated('core/noisy > a > b', config)).toBe(false)
  })
})

describe('compareRounds', () => {
  const base = createFile({
    'core/a': 100,
    'core/noisy': 100,
    'vue/v': 100,
    'core/s': 100,
    'core/gone': 1,
  })
  const rounds = [
    // core/a: one bad round out of three is noise; core/noisy, vue/v: slow; core/s: fast.
    {
      base,
      head: createFile({
        'core/a': 50,
        'core/noisy': 50,
        'vue/v': 50,
        'core/s': 200,
        'core/new': 1,
      }),
    },
    {
      base,
      head: createFile({
        'core/a': 100,
        'core/noisy': 50,
        'vue/v': 50,
        'core/s': 200,
        'core/new': 1,
      }),
    },
    {
      base,
      head: createFile({
        'core/a': 95,
        'core/noisy': 50,
        'vue/v': 50,
        'core/s': 200,
        'core/new': 1,
      }),
    },
  ]
  const report = compareRounds(rounds, config)
  const row = (id: string) => report.rows.find((item) => item.id === id)!

  it('takes the median of the per-round ratios, so one bad round does not fail a case', () => {
    expect(row('core/a')).toMatchObject({
      ratios: [0.5, 1, 0.95],
      median: 0.95,
      low: 0.5,
      high: 1,
      below: 1,
    })
    expect(row('core/a').status).toBe('same')
  })

  it('fails a gated case below the threshold and only marks the ones that are not gated', () => {
    expect(row('core/noisy')).toMatchObject({ isGated: false, status: 'slower', below: 3 })
    expect(row('vue/v').status).toBe('slower')
    expect(report.rows.some((item) => item.status === 'fail')).toBe(false)
    const slow = createFile({ 'core/a': 10, 'core/noisy': 50, 'vue/v': 50, 'core/s': 200 })
    const failing = compareRounds([{ base, head: slow }], config)
    expect(failing.rows.find((item) => item.id === 'core/a')?.status).toBe('fail')
  })

  it('marks a case above the inverse of the threshold as faster', () => {
    expect(row('core/s').status).toBe('faster')
  })

  it('lists the cases only one side has, and does not compare them', () => {
    expect(report.added).toEqual(['core/new'])
    expect(report.removed).toEqual(['core/gone'])
    expect(report.rows.map((item) => item.id)).not.toContain('core/new')
    expect(report.rounds).toBe(3)
  })
})

describe('formatGate', () => {
  const base = createFile({ 'core/a': 100, 'vue/v': 100, 'core/gone': 1 })
  const make = (a: number) =>
    compareRounds([{ base, head: createFile({ 'core/a': a, 'vue/v': 50, 'core/new': 1 }) }], config)

  it('says passed, and lists what moved without failing', () => {
    const text = formatGate(make(100))
    expect(text).toContain('Passed: 1 gated cases, none below 0.8; 1 cases are report only.')
    expect(text).toContain('### Moved')
    expect(text).toContain('| vue/v | report only | 0.50 | 0.50 to 0.50 | 1/1 | slower |')
    expect(text).toContain('Only in the head (1), only in the base (1)')
    expect(text).not.toContain('### Failed')
  })

  it('says failed, and lists the failures with how to read them', () => {
    const text = formatGate(make(50))
    expect(text).toContain('FAILED: 1 of 1 gated cases are below 0.8.')
    expect(text).toContain('### Failed')
    expect(text).toContain('| core/a | gated | 0.50 | 0.50 to 0.50 | 1/1 | FAIL |')
  })

  it('leaves out the sections that have nothing in them', () => {
    const same = compareRounds(
      [{ base: createFile({ 'core/a': 1 }), head: createFile({ 'core/a': 1 }) }],
      config
    )
    const text = formatGate(same)
    expect(text).not.toContain('### Moved')
    expect(text).not.toContain('Only in the head')
    expect(text).toContain('<details><summary>Every case</summary>')
  })
})

describe('runGate', () => {
  /** A machine of two folders whose suites run at the speeds given, in the order they are run. */
  function setup(
    speeds: { base: number; head: number },
    options: { hasSuite?: boolean; status?: number } = {}
  ) {
    const lines: string[] = []
    const ran: string[] = []
    const written = new Map<string, string>()
    const deps: GateDeps = {
      hasSuite: (dir) => options.hasSuite ?? dir === 'b',
      runSuite: (dir, outDir) => {
        ran.push(`${dir}:${outDir}`)
        return options.status ?? 0
      },
      readResult: (path) =>
        createFile({ 'core/a': path.includes('base') ? speeds.base : speeds.head }),
      writeText: (path, text) => written.set(path, text),
      write: (line) => lines.push(line),
    }
    return { deps, lines, ran, written }
  }
  const run = (argv: string[], speeds = { base: 100, head: 100 }, options = {}) => {
    const machine = setup(speeds, options)
    return { code: runGate(argv, config, 'default-out', machine.deps), ...machine }
  }

  it('measures the two folders in alternating order, round after round, and passes when nothing is slower', () => {
    const { code, ran, written, lines } = run(
      ['--base', 'b', '--head', 'head', '--rounds', '2', '--out', 'o'],
      undefined,
      {
        hasSuite: true,
      }
    )
    expect(code).toBe(0)
    expect(ran).toEqual([
      'b:o/round-1-base',
      'head:o/round-1-head',
      'head:o/round-2-head',
      'b:o/round-2-base',
    ])
    expect(written.get('o/gate.md')).toContain('Passed')
    expect(lines.join('\n')).toContain('Passed')
  })

  it('exits 1 when a gated case is slower in the head, with the default rounds and folder', () => {
    const { code, ran, written } = run(
      ['--', '--base', 'b', '--head', 'h'],
      { base: 100, head: 50 },
      { hasSuite: true }
    )
    expect(code).toBe(1)
    expect(ran).toHaveLength(8)
    expect(written.has('default-out/gate.md')).toBe(true)
  })

  it('takes the threshold from the call', () => {
    const slower = { base: 100, head: 50 }
    expect(
      run(['--base', 'b', '--head', 'h', '--threshold', '0.4'], slower, { hasSuite: true }).code
    ).toBe(0)
  })

  it('passes with a notice, and runs nothing, when the base has no suite', () => {
    const { code, ran, lines } = run(['--base', 'old', '--head', 'head'], undefined, {
      hasSuite: false,
    })
    expect(code).toBe(0)
    expect(ran).toEqual([])
    expect(lines[0]).toContain(
      '::notice title=Benchmark gate::The base (old) has no benchmark suite'
    )
  })

  it('exits 2 when a suite fails to run', () => {
    const { code, lines } = run(['--base', 'b', '--head', 'h'], undefined, {
      hasSuite: true,
      status: 1,
    })
    expect(code).toBe(2)
    expect(lines.join('\n')).toContain('failed to run')
  })

  it('exits 2 with the usage for a wrong call', () => {
    const wrong = [
      [],
      ['--base', 'b'],
      ['--head', 'h'],
      ['--base', 'b', '--head', 'h', '--rounds', '0'],
      ['--base', 'b', '--head', 'h', '--rounds', '1.5'],
      ['--base', 'b', '--head', 'h', '--rounds', 'x'],
      ['--base', 'b', '--head', 'h', '--threshold', 'x'],
    ]
    for (const argv of wrong) {
      const { code, lines } = run(argv)
      expect(code).toBe(2)
      expect(lines[0]).toContain('Use: bench:gate')
    }
  })
})
