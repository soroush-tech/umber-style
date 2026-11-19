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
