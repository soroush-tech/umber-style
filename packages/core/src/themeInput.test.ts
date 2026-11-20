import { EMPTY_THEME, mergeTheme, resolveThemeInput } from './themeInput'

describe('resolveThemeInput', () => {
  it('calls a function with the theme above, and gives an object as it is', () => {
    const outer = { a: 1 }
    const given = { a: 2 }
    expect(resolveThemeInput(given, outer)).toBe(given)
    expect(resolveThemeInput((above: typeof outer) => ({ a: above.a + 1 }), outer)).toEqual({
      a: 2,
    })
  })
})

describe('mergeTheme', () => {
  it('merges over the theme above, and takes the theme as it is with nothing above', () => {
    const given = { a: { b: 2 } }
    expect(mergeTheme(undefined, given)).toBe(given)
    expect(mergeTheme<{ a: { b: number; c: number } }>({ a: { b: 1, c: 1 } }, given)).toEqual({
      a: { b: 2, c: 1 },
    })
  })
})

describe('EMPTY_THEME', () => {
  it('has nothing in it and cannot be changed', () => {
    expect(Object.keys(EMPTY_THEME)).toEqual([])
    expect(Object.isFrozen(EMPTY_THEME)).toBe(true)
  })
})
