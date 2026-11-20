import { mergeDeep } from './mergeDeep'

describe('mergeDeep', () => {
  it('merges plain objects key by key and does not change its inputs', () => {
    const base = { a: { b: 1, c: 2 }, d: 3 }
    const override = { a: { b: 9 } }
    expect(mergeDeep(base, override)).toEqual({ a: { b: 9, c: 2 }, d: 3 })
    expect(base).toEqual({ a: { b: 1, c: 2 }, d: 3 })
  })

  it('replaces arrays, functions and primitives', () => {
    const fn = () => 1
    expect(mergeDeep({ list: [1, 2, 3], fn: () => 0, n: 1 }, { list: [4], fn, n: 2 })).toEqual({
      list: [4],
      fn,
      n: 2,
    })
  })

  it('replaces a value by an object and an object by a value', () => {
    expect(
      mergeDeep<Record<string, unknown>>({ a: 1, b: { c: 1 } }, { a: { x: 1 }, b: 2 })
    ).toEqual({ a: { x: 1 }, b: 2 })
  })

  it('keeps the base for an undefined override', () => {
    const base = { a: 1, b: { c: 2 } }
    expect(mergeDeep(base, undefined)).toBe(base)
    expect(mergeDeep(base, { a: undefined })).toEqual(base)
  })

  it('treats a class instance as a value', () => {
    const date = new Date(0)
    expect(mergeDeep<Record<string, unknown>>({ when: { y: 1 } }, { when: date }).when).toBe(date)
    expect(mergeDeep<Record<string, unknown>>({ a: null }, { a: { b: 1 } })).toEqual({
      a: { b: 1 },
    })
  })
})

describe('mergeDeep and members that are not enumerable', () => {
  /** Breakpoints with a helper function that is not enumerable, as a theme helper makes them. */
  const withHelper = (values: Record<string, number>, up: (key: string) => string) =>
    Object.defineProperty({ values }, 'up', { value: up, enumerable: false })

  it('keeps the helpers of the base when the override sets the key', () => {
    const up = (key: string) => `@media (min-width: ${key})`
    const base = { breakpoints: withHelper({ sm: 600 }, up), palette: { a: 1 } }
    const merged = mergeDeep(base, { breakpoints: { values: { sm: 480 } } } as never)
    expect(merged.breakpoints.values).toEqual({ sm: 480 })
    expect((merged.breakpoints as unknown as { up: typeof up }).up).toBe(up)
    expect(Object.keys(merged.breakpoints)).toEqual(['values'])
  })

  it('takes the helpers of the override over those of the base, and its accessors as they are', () => {
    const first = () => 'first'
    const second = () => 'second'
    const get = () => 3
    const override = withHelper({ sm: 1 }, second)
    Object.defineProperty(override, 'count', { get, enumerable: true })
    const merged = mergeDeep({ breakpoints: withHelper({ sm: 600 }, first) }, {
      breakpoints: override,
    } as never)
    expect((merged.breakpoints as unknown as { up: () => string }).up).toBe(second)
    expect(Object.getOwnPropertyDescriptor(merged.breakpoints, 'count')?.get).toBe(get)
  })

  it('keeps symbol keys and an object with no prototype', () => {
    const key = Symbol('key')
    const base = Object.assign(Object.create(null) as Record<PropertyKey, unknown>, {
      [key]: 1,
      a: 1,
    })
    const merged = mergeDeep(base, { [key]: 2 })
    expect(Object.getPrototypeOf(merged)).toBe(null)
    expect(merged[key]).toBe(2)
    expect(merged.a).toBe(1)
  })
})
