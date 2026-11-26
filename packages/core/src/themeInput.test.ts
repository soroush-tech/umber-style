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

describe('mergeTheme of a theme of the same contents', () => {
  const outer = { palette: { primary: '#0000ff', text: '#111111' }, space: [0, 4] }

  it('gives the theme of an earlier merge for the same object, a shallow copy and a deep copy', () => {
    const given = { palette: { primary: '#ff0000' } }
    const merged = mergeTheme(outer, given)
    expect(merged).toEqual({ palette: { primary: '#ff0000', text: '#111111' }, space: [0, 4] })
    expect(mergeTheme(outer, given)).toBe(merged)
    expect(mergeTheme(outer, { ...given })).toBe(merged)
    expect(mergeTheme(outer, structuredClone(given))).toBe(merged)
  })

  it('merges again for a value changed, and over another theme above', () => {
    const merged = mergeTheme(outer, { palette: { primary: '#ff0000' } })
    const changed = mergeTheme(outer, { palette: { primary: '#00ff00' } })
    expect(changed).not.toBe(merged)
    expect(changed).toEqual({ palette: { primary: '#00ff00', text: '#111111' }, space: [0, 4] })
    const other = { ...outer }
    expect(mergeTheme(other, { palette: { primary: '#ff0000' } })).not.toBe(merged)
  })

  it('gives the same theme for the same pair of objects every time, one for each pair', () => {
    const light = { palette: { primary: '#ff0000' } }
    const dark = { palette: { primary: '#000000', text: '#ffffff' } }
    const lightMerged = mergeTheme(outer, light)
    const darkMerged = mergeTheme(outer, dark)
    expect(mergeTheme(outer, light)).toBe(lightMerged)
    expect(mergeTheme(outer, dark)).toBe(darkMerged)
    expect(darkMerged).toEqual({ palette: { primary: '#000000', text: '#ffffff' }, space: [0, 4] })
  })

  it('takes the theme above for a given that is nothing, as before', () => {
    expect(mergeTheme(outer, undefined as never)).toBe(outer)
  })

  it('merges over a value above that is not an object as before', () => {
    expect(mergeTheme<unknown>('above', { a: 1 })).toEqual({ a: 1 })
    expect(mergeTheme<unknown>(null, { a: 1 })).toEqual({ a: 1 })
  })
})

describe('EMPTY_THEME', () => {
  it('has nothing in it and cannot be changed', () => {
    expect(Object.keys(EMPTY_THEME)).toEqual([])
    expect(Object.isFrozen(EMPTY_THEME)).toBe(true)
  })
})

describe('resolveThemeInput with a guard', () => {
  it('gives a function the theme above through the guard, and an object as it is', () => {
    const outer = { a: 1 }
    const calls: unknown[][] = []
    const guard = <V extends object>(theme: V, label: string): V => {
      calls.push([theme, label])
      return { ...theme, a: 2 }
    }
    expect(resolveThemeInput((above: typeof outer) => ({ a: above.a + 1 }), outer, guard)).toEqual({
      a: 3,
    })
    const given = { a: 5 }
    expect(resolveThemeInput(given, outer, guard)).toBe(given)
    expect(calls).toEqual([[outer, 'ThemeProvider']])
  })
})
