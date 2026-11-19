import { GATE_CONFIG, GATE_SUITE } from './gate-config'
import { isGated } from './gate'

describe('the gate config', () => {
  it('has a threshold below 1, so that a case has to get slower to fail', () => {
    expect(GATE_CONFIG.threshold).toBeGreaterThan(0)
    expect(GATE_CONFIG.threshold).toBeLessThan(1)
  })

  it('takes every report-only prefix out of a gated one', () => {
    for (const prefix of GATE_CONFIG.reportOnly) {
      expect(GATE_CONFIG.gated.some((gated) => prefix.startsWith(gated))).toBe(true)
      expect(isGated(prefix, GATE_CONFIG)).toBe(false)
    }
  })

  it('runs files by the name of a benchmark file, and gives both sides the same time', () => {
    expect(GATE_SUITE.files.length).toBeGreaterThan(0)
    for (const file of GATE_SUITE.files) expect(file).toMatch(/\.bench$/)
    expect(Number(GATE_SUITE.env.BENCH_TIME)).toBeGreaterThan(0)
  })
})
