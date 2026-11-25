import { createThemeMemo, isSameTheme, RECENT_THEMES } from './sameTheme'

const theme = {
  palette: { primary: '#0000ff', text: ['#111111', '#222222'] },
  space: [0, 4, 8],
  breakpoints: { md: 900 },
  format: (value: number) => `${value}px`,
}

describe('isSameTheme', () => {
  it('is true for the same object, a shallow copy and a deep copy', () => {
    expect(isSameTheme(theme, theme)).toBe(true)
    expect(isSameTheme(theme, { ...theme })).toBe(true)
    expect(
      isSameTheme(theme, { ...structuredClone({ ...theme, format: 0 }), format: theme.format })
    ).toBe(true)
  })

  it('is false for a value changed anywhere, a key more or less, and keys in another order', () => {
    expect(isSameTheme(theme, { ...theme, palette: { ...theme.palette, primary: 'red' } })).toBe(
      false
    )
    expect(isSameTheme(theme, { ...theme, space: [0, 4, 9] })).toBe(false)
    expect(isSameTheme(theme, { ...theme, extra: 1 })).toBe(false)
    const { format, ...rest } = theme
    expect(isSameTheme(theme, { format, ...rest })).toBe(false)
    expect(isSameTheme({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false)
  })

  it('compares a function, a class instance and a date by identity', () => {
    expect(isSameTheme(theme, { ...theme, format: (value: number) => `${value}px` })).toBe(false)
    const date = new Date(0)
    expect(isSameTheme({ when: date }, { when: date })).toBe(true)
    expect(isSameTheme({ when: date }, { when: new Date(0) })).toBe(false)
    expect(isSameTheme(1, 1)).toBe(true)
    expect(isSameTheme(1, '1')).toBe(false)
  })

  it('tells arrays from objects, and objects of another prototype', () => {
    expect(isSameTheme({ list: [1] }, { list: { 0: 1 } })).toBe(false)
    expect(isSameTheme(Object.create(null) as object, {})).toBe(false)
    const bare = Object.assign(Object.create(null) as object, { a: 1 })
    expect(isSameTheme(bare, Object.assign(Object.create(null) as object, { a: 1 }))).toBe(true)
  })

  it('reads members that are not enumerable, symbols and accessors', () => {
    const up = () => 'up'
    const withHelper = (helper: () => string, isEnumerable = false) =>
      Object.defineProperty({ md: 900 }, 'up', { value: helper, enumerable: isEnumerable })
    expect(isSameTheme(withHelper(up), withHelper(up))).toBe(true)
    expect(
      isSameTheme(
        withHelper(up),
        withHelper(() => 'up')
      )
    ).toBe(false)
    expect(isSameTheme(withHelper(up), withHelper(up, true))).toBe(false)
    const key = Symbol('key')
    expect(isSameTheme({ [key]: 1 }, { [key]: 1 })).toBe(true)
    expect(isSameTheme({ [key]: 1 }, { [key]: 2 })).toBe(false)
    const get = () => 1
    const withGetter = (read: () => number) =>
      Object.defineProperty({}, 'size', { get: read, enumerable: true })
    expect(isSameTheme(withGetter(get), withGetter(get))).toBe(true)
    expect(
      isSameTheme(
        withGetter(get),
        withGetter(() => 1)
      )
    ).toBe(false)
    expect(isSameTheme(withGetter(get), { size: 1 })).toBe(false)
    expect(isSameTheme({ size: 1 }, withGetter(get))).toBe(false)
  })

  it('compares a theme that refers to itself once around the cycle', () => {
    const first: Record<string, unknown> = { a: 1 }
    first.self = first
    const second: Record<string, unknown> = { a: 1 }
    second.self = second
    expect(isSameTheme(first, second)).toBe(true)
    const third: Record<string, unknown> = { a: 2 }
    third.self = third
    expect(isSameTheme(first, third)).toBe(false)
  })
})

describe('createThemeMemo', () => {
  it('gives the first object seen with the same contents, and an object of other contents itself', () => {
    const findSame = createThemeMemo()
    expect(findSame(theme)).toBe(theme)
    const copy = { ...theme }
    expect(findSame(copy)).toBe(theme)
    expect(findSame(copy)).toBe(theme)
    const changed = { ...theme, space: [0, 4, 9] }
    expect(findSame(changed)).toBe(changed)
    expect(findSame({ ...changed })).toBe(changed)
  })

  it('keeps the last themes of distinct contents used, and forgets the one used longest ago', () => {
    const findSame = createThemeMemo()
    const themes = Array.from({ length: RECENT_THEMES + 1 }, (_, index) => ({ index }))
    for (const each of themes) findSame(each)
    expect(findSame({ index: 0 })).not.toBe(themes[0])
    expect(findSame({ index: RECENT_THEMES })).toBe(themes[RECENT_THEMES])
  })
})
