import { createDeferredObject, createDeferredRecord, createLazyRecord } from './lazyRecord'

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

describe('createDeferredObject', () => {
  /** A frozen object with a getter, a hidden symbol and a method, as a sheet entry is. */
  const makeEntry = () => {
    const hidden = Symbol.for('test.hidden')
    const entry = { visible: null, [Symbol.for('test.brand')]: true }
    Object.defineProperties(entry, {
      name: { get: () => 'a-1' },
      toString: { value: () => 'a-1' },
      [hidden]: { value: 'source' },
    })
    return Object.freeze(entry)
  }

  it('makes nothing until it is used', () => {
    const make = vi.fn(makeEntry)
    createDeferredObject(make)
    expect(make).not.toHaveBeenCalled()
  })

  it('is the object that make returns, made once, for every way of using it', () => {
    const make = vi.fn(makeEntry)
    const object = createDeferredObject<Record<string | symbol, unknown>>(make)
    expect(object.name).toBe('a-1')
    expect(String(object)).toBe('a-1')
    expect(Symbol.for('test.brand') in object).toBe(true)
    expect(object[Symbol.for('test.hidden')]).toBe('source')
    expect(Object.keys(object)).toEqual(['visible'])
    expect({ ...object }).toEqual({ visible: null, [Symbol.for('test.brand')]: true })
    expect(Object.getPrototypeOf(object)).toBe(Object.prototype)
    expect(Object.isFrozen(object)).toBe(true)
    expect(make).toHaveBeenCalledTimes(1)
  })

  it('makes it on the first use of any kind', () => {
    const uses: ((object: object) => unknown)[] = [
      (object) => 'visible' in object,
      Object.keys,
      Object.getPrototypeOf,
      Object.isExtensible,
      (object) => Object.getOwnPropertyDescriptor(object, 'visible'),
    ]
    for (const use of uses) {
      const make = vi.fn(makeEntry)
      use(createDeferredObject(make))
      expect(make).toHaveBeenCalledTimes(1)
    }
  })

  it('stays extensible when what it stands for is, and keeps its prototype', () => {
    class Point {
      x = 1
    }
    const object = createDeferredObject(() => new Point())
    expect(object).toBeInstanceOf(Point)
    expect(object.x).toBe(1)
    expect(Object.isExtensible(object)).toBe(true)
  })

  it('tries again on the next use when make throws', () => {
    let calls = 0
    const object = createDeferredObject(() => {
      calls++
      if (calls === 1) throw new Error('not yet')
      return { done: true }
    })
    expect(() => object.done).toThrow('not yet')
    expect(object.done).toBe(true)
  })
})
