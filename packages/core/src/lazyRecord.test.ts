import { createDeferredRecord, createLazyRecord } from './lazyRecord'

describe('createLazyRecord', () => {
  it('makes nothing until a key is read, and each value once', () => {
    const make = vi.fn((key: string) => ({ key }))
    const record = createLazyRecord(['a', 'b'], make)
    expect(make).not.toHaveBeenCalled()
    expect(Object.keys(record)).toEqual(['a', 'b'])
    expect(make).not.toHaveBeenCalled()
    expect(record.a).toBe(record.a)
    expect(make).toHaveBeenCalledTimes(1)
    expect({ ...record }).toEqual({ a: { key: 'a' }, b: { key: 'b' } })
    expect(make).toHaveBeenCalledTimes(2)
  })

  it('keeps a value that is undefined, and is frozen', () => {
    const make = vi.fn(() => undefined)
    const record = createLazyRecord(['a'], make)
    expect(record.a).toBeUndefined()
    expect(record.a).toBeUndefined()
    expect(make).toHaveBeenCalledTimes(1)
    expect(Object.isFrozen(record)).toBe(true)
  })
})

describe('createDeferredRecord', () => {
  it('builds the whole record once, when the first key is read', () => {
    const build = vi.fn(() => ({ a: 1, b: 2 }))
    const record = createDeferredRecord({ a: 0, b: 0 }, build)
    expect(Object.keys(record)).toEqual(['a', 'b'])
    expect(build).not.toHaveBeenCalled()
    expect(record.b).toBe(2)
    expect(record.a).toBe(1)
    expect(build).toHaveBeenCalledTimes(1)
  })
})
