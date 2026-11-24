import { findEndOffset, readEndStyle, translateSteps } from './motionSteps'

describe('findEndOffset', () => {
  it('gives the step a finite animation ends on, from its count and direction', () => {
    const table: [unknown, string, string | undefined][] = [
      [1, 'normal', '100%'],
      [2, 'normal', '100%'],
      [1, 'reverse', '0%'],
      [1, 'alternate', '100%'],
      [2, 'alternate', '0%'],
      [3, 'alternate', '100%'],
      [1, 'alternate-reverse', '0%'],
      [2, 'alternate-reverse', '100%'],
      [0, 'normal', '0%'],
      [0, 'reverse', '100%'],
      ['infinite', 'normal', undefined],
      [1.5, 'normal', undefined],
    ]
    for (const [count, direction, offset] of table) {
      expect(findEndOffset(count, direction)).toBe(offset)
    }
  })
})

describe('readEndStyle', () => {
  const fade = { '0%': { opacity: 0 }, '100%': { opacity: 1, animationTimingFunction: 'ease' } }
  const grow = { '0%': { width: 10 }, '100%': { width: 20 } }
  const stepsOf = new Map<unknown, Record<string, Record<string, unknown>>>([
    ['fade', fade],
    ['grow', grow],
  ])
  const readSteps = (rule: unknown) => stepsOf.get(rule)

  it('merges the end step of each finite animation that fills forwards, in order, without its easing', () => {
    expect(
      readEndStyle(
        {
          animationName: ['fade', 'grow'],
          animationFillMode: ['forwards', 'both'],
          animationIterationCount: [1, 2],
          animationDirection: ['normal', 'alternate'],
        },
        readSteps
      )
    ).toEqual({ opacity: 1, width: 10 })
  })

  it('leaves out an animation that does not fill forwards, never ends, or has no rule it knows', () => {
    expect(readEndStyle({ animationName: 'fade' }, readSteps)).toEqual({})
    expect(
      readEndStyle({ animationName: 'fade', animationFillMode: 'backwards' }, readSteps)
    ).toEqual({})
    expect(
      readEndStyle(
        {
          animationName: 'fade',
          animationFillMode: 'forwards',
          animationIterationCount: 'infinite',
        },
        readSteps
      )
    ).toEqual({})
    expect(
      readEndStyle({ animationName: 'none', animationFillMode: 'forwards' }, readSteps)
    ).toEqual({})
    expect(
      readEndStyle({ animationName: 'grow', animationFillMode: 'forwards' }, () => ({ '50%': {} }))
    ).toEqual({})
  })
})

describe('translateSteps', () => {
  it('names each step by its offset and merges the steps of one offset, the later winning', () => {
    const readEasing = () => undefined
    expect(
      translateSteps(
        {
          'from, 50.0%': { opacity: 0, margin: '8px' },
          '50%': { opacity: 0.5 },
          to: { opacity: 1 },
        },
        { remBase: 16, name: undefined, readEasing }
      )
    ).toEqual({
      '0%': { opacity: 0, margin: 8 },
      '50%': { opacity: 0.5, margin: 8 },
      '100%': { opacity: 1 },
    })
  })
})
