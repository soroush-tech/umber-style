import { isSameView } from './sameView'

describe('isSameView', () => {
  it('is true for one value, and for plain objects and arrays with the same members', () => {
    const shared = () => 'shared'
    expect(isSameView('var(--a)', 'var(--a)')).toBe(true)
    expect(
      isSameView({ a: 'var(--a)', b: [1, { c: shared }] }, { a: 'var(--a)', b: [1, { c: shared }] })
    ).toBe(true)
    expect(isSameView(Object.create(null), Object.create(null))).toBe(true)
  })

  it('is false for another value, another prototype, other keys or another member', () => {
    expect(isSameView('var(--a)', 'var(--b)')).toBe(false)
    expect(isSameView({}, [])).toBe(false)
    expect(isSameView({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(isSameView({ a: 1 }, { b: 1 })).toBe(false)
    expect(isSameView({ a: [1, 2] }, { a: [1, 3] })).toBe(false)
  })

  it('compares a function, a class instance and a date by identity', () => {
    expect(isSameView({ a: () => 1 }, { a: () => 1 })).toBe(false)
    expect(isSameView(new Date(0), new Date(0))).toBe(false)
    class Box {
      readonly value = 1
    }
    expect(isSameView(new Box(), new Box())).toBe(false)
  })

  it('compares the members that are not enumerable and the symbol keys, and accessors without calling them', () => {
    const key = Symbol('key')
    const get = vi.fn(() => 1)
    const make = (hidden: number) => {
      const view = { [key]: 'symbol' }
      Object.defineProperty(view, 'hidden', { value: hidden, enumerable: false })
      Object.defineProperty(view, 'read', { get, enumerable: true })
      return view
    }
    expect(isSameView(make(1), make(1))).toBe(true)
    expect(isSameView(make(1), make(2))).toBe(false)
    expect(get).not.toHaveBeenCalled()
    const other = {}
    Object.defineProperty(other, 'read', { get: () => 1, enumerable: true })
    const own = {}
    Object.defineProperty(own, 'read', { get, enumerable: true })
    expect(isSameView(own, other)).toBe(false)
    expect(isSameView({ read: 1 }, own)).toBe(false)
  })

  it(
    'compares a view that refers to itself once around the cycle, and returns',
    { timeout: 1000 },
    () => {
      type Node = { name: string; self?: Node; list?: Node[] }
      const first: Node = { name: 'var(--a)' }
      first.self = first
      first.list = [first]
      const second: Node = { name: 'var(--a)' }
      second.self = second
      second.list = [second]
      expect(isSameView(first, second)).toBe(true)
      const third: Node = { name: 'var(--b)' }
      third.self = third
      third.list = [third]
      expect(isSameView(first, third)).toBe(false)
    }
  )

  it('tells apart a cycle whose members differ further round', { timeout: 1000 }, () => {
    type Node = { value: number; next?: Node }
    const loop: Node = { value: 1 }
    loop.next = loop
    const tail: Node = { value: 2 }
    tail.next = tail
    expect(isSameView(loop, { value: 1, next: tail })).toBe(false)
  })

  it('compares one object of the first view with two of the second', () => {
    const shared = { a: 1 }
    expect(isSameView({ x: shared, y: shared }, { x: { a: 1 }, y: { a: 1 } })).toBe(true)
    expect(isSameView({ x: shared, y: shared }, { x: { a: 1 }, y: { a: 2 } })).toBe(false)
  })
})
