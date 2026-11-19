import { cloneTheme, countTokens, createColor, createLargeTheme, createSmallTheme } from './themes'

describe('the benchmark themes', () => {
  it('has about 20 tokens in the small theme and about 300 in the large one', () => {
    expect(countTokens(createSmallTheme())).toBe(20)
    const large = countTokens(createLargeTheme())
    expect(large).toBeGreaterThanOrEqual(280)
    expect(large).toBeLessThanOrEqual(320)
  })

  it('builds the same theme every time', () => {
    expect(createLargeTheme()).toEqual(createLargeTheme())
    expect(createSmallTheme()).toEqual(createSmallTheme())
    expect(createColor(3)).toBe(createColor(3))
    expect(createColor(3)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('has breakpoints that are not tokens, and a distinct colour for each shade', () => {
    const { palette, breakpoints } = createLargeTheme()
    expect(breakpoints.length).toBeGreaterThan(1)
    expect(new Set(Object.values(palette)).size).toBe(Object.keys(palette).length)
  })

  it('clones a theme into another object with the same values', () => {
    const theme = createSmallTheme()
    const copy = cloneTheme(theme)
    expect(copy).not.toBe(theme)
    expect(copy).toEqual(theme)
  })
})
