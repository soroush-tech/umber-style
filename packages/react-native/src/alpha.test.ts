import { alpha } from './alpha'

describe('alpha on React Native', () => {
  it('turns #rrggbb into rgba', () => {
    expect(alpha('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)')
  })

  it('turns #rgb into rgba', () => {
    expect(alpha('#F80', 0.25)).toBe('rgba(255, 136, 0, 0.25)')
  })

  it('reads the forms that the web fallback reads, and multiplies the alpha it finds', () => {
    expect(alpha('#f808', 0.5)).toBe('rgba(255, 136, 0, 0.2667)')
    expect(alpha('#ff800080', 0.5)).toBe('rgba(255, 128, 0, 0.251)')
    expect(alpha('rgb(1, 2, 3)', 0.5)).toBe('rgba(1, 2, 3, 0.5)')
    expect(alpha('rgba(1, 2, 3, 0.5)', 0.5)).toBe('rgba(1, 2, 3, 0.25)')
    expect(alpha('rgb(1 2 3 / 50%)', 0.5)).toBe('rgba(1, 2, 3, 0.25)')
    expect(alpha(' #fff ', 0.3)).toBe('rgba(255, 255, 255, 0.3)')
  })

  it('returns a colour that it cannot read as it is', () => {
    for (const color of ['red', '#ff80f', '#gggggg', 'var(--x)', 'hsl(0 0% 0%)']) {
      expect(alpha(color, 0.5)).toBe(color)
    }
  })

  it('returns the colour for 1 and transparent for 0, like the web', () => {
    expect(alpha('#ff8000', 1)).toBe('#ff8000')
    expect(alpha('var(--x)', 1)).toBe('var(--x)')
    expect(alpha('#ff8000', 0)).toBe('transparent')
    expect(alpha('var(--x)', 0)).toBe('transparent')
  })

  it('throws a TypeError for a colour that is not a string or an opacity that is not a number', () => {
    expect(() => alpha(1 as unknown as string, 0.5)).toThrow(TypeError)
    expect(() => alpha(1 as unknown as string, 0.5)).toThrow(
      'the color must be a string, got number'
    )
    expect(() => alpha('#fff', '0.5' as unknown as number)).toThrow(TypeError)
    expect(() => alpha('#fff', '0.5' as unknown as number)).toThrow(
      'the opacity must be a number, got string'
    )
  })

  it('throws a RangeError for an opacity outside 0 to 1, or NaN', () => {
    for (const opacity of [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => alpha('#fff', opacity)).toThrow(RangeError)
    }
    expect(() => alpha('#fff', 2)).toThrow('the opacity must be from 0 to 1, got 2')
  })
})
