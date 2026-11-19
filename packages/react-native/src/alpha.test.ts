import { alpha } from './alpha'

describe('alpha on React Native', () => {
  it('turns #rrggbb into rgba', () => {
    expect(alpha('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)')
  })

  it('turns #rgb into rgba', () => {
    expect(alpha('#F80', 0.25)).toBe('rgba(255, 136, 0, 0.25)')
  })

  it('returns any other string as it is', () => {
    for (const color of ['red', 'rgb(1, 2, 3)', '#ff80', '#gggggg', 'var(--x)']) {
      expect(alpha(color, 0.5)).toBe(color)
    }
  })
})
