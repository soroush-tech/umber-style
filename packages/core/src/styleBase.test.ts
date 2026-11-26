import { types } from 'node:util'
import { callCheckedStyle, createStyleArgument, isStyleFunction, splitLeading } from './styleBase'
import type { StyleInput } from './types'

const view = { palette: { primary: 'var(--x)' } }

/** `list` typed as the style list, for the functions of a test that read props. */
const asList = (...items: unknown[]) => items as StyleInput[]

describe('isStyleFunction', () => {
  it('knows a function style from an object', () => {
    expect(isStyleFunction(() => false)).toBe(true)
    expect(isStyleFunction({ color: 'red' })).toBe(false)
  })
})

describe('splitLeading', () => {
  it('takes plain objects and functions that read only the theme', () => {
    const list = asList({ a: 1 }, ({ theme }: { theme: typeof view }) => ({
      c: theme.palette.primary,
    }))
    expect(splitLeading(list, { x: 1 }, view)).toEqual({
      base: [{ a: 1 }, { c: 'var(--x)' }],
      propsFrom: 2,
    })
  })

  it('stops at the first function that reads a prop, and everything after it is the props part', () => {
    const list = asList(
      { a: 1 },
      ({ tone }: { tone: string }) => ({ c: tone }),
      { b: 2 },
      () => ({ d: 1 })
    )
    const { base, propsFrom } = splitLeading(list, { tone: 'red' }, view)
    expect(base).toEqual([{ a: 1 }])
    expect(propsFrom).toBe(1)
  })

  it('notes a prop that is read by destructuring, even when it is not there', () => {
    const list = asList(({ isOpen }: { isOpen?: boolean }) => ({
      display: isOpen ? 'block' : 'none',
    }))
    expect(splitLeading(list, {}, view).propsFrom).toBe(0)
  })

  it('notes every way of listing the props: a spread, Object.keys, in, and a descriptor', () => {
    const readers = [
      (props: object) => ({ ...props }),
      (props: object) => ({ n: Object.keys(props).length }),
      (props: object) => ({ n: 'tone' in props }),
      (props: object) => ({ n: Object.getOwnPropertyDescriptor(props, 'tone') }),
    ]
    for (const reader of readers) {
      expect(splitLeading(asList(reader), { tone: 'red' }, view).propsFrom).toBe(0)
    }
  })

  it('does not note theme, however it is read', () => {
    const readers = [
      ({ theme }: { theme: typeof view }) => ({ c: theme.palette.primary }),
      (props: { theme: typeof view }) => ({ c: props.theme.palette.primary }),
      (props: object) => ({ c: 'theme' in props }),
      (props: object) => ({ c: Object.getOwnPropertyDescriptor(props, 'theme')?.value ? 1 : 0 }),
    ]
    for (const reader of readers) {
      expect(splitLeading(asList(reader), { tone: 'red' }, view).propsFrom).toBe(1)
    }
  })

  it('passes the real theme view, never a wrapper of it, and wraps only the props', () => {
    const seen: { theme: unknown; isProxy: boolean }[] = []
    const reader = (props: { theme: unknown }) => {
      seen.push({ theme: props.theme, isProxy: types.isProxy(props) })
      return false as const
    }
    splitLeading(asList(reader), {}, view)
    expect(seen[0].theme).toBe(view)
    expect(seen[0].isProxy).toBe(true)
    expect(types.isProxy(view)).toBe(false)
  })

  it('keeps what the function does: a throw for a missing prop is the same throw', () => {
    const list = asList((props: { name?: string }) => {
      if (props.name === undefined) throw new RangeError('name is needed')
      return { c: props.name }
    })
    expect(() => splitLeading(list, {}, view)).toThrow(RangeError)
    expect(splitLeading(list, { name: 'x' }, view).propsFrom).toBe(0)
  })

  it('leaves out the empty results at the end of the base when there is a props part', () => {
    const list = asList(
      { a: 1 },
      { label: 'x' },
      () => false,
      ({ tone }: { tone: string }) => ({ c: tone })
    )
    expect(splitLeading(list, { tone: 'red' }, view)).toEqual({ base: [{ a: 1 }], propsFrom: 3 })
  })

  it('keeps all of the base when there is no props part', () => {
    const list = asList({ a: 1 }, { label: 'x' })
    expect(splitLeading(list, {}, view)).toEqual({ base: [{ a: 1 }, { label: 'x' }], propsFrom: 2 })
  })

  it('gives an empty base for an empty list or a list that starts with a props function', () => {
    expect(splitLeading([], {}, view)).toEqual({ base: [], propsFrom: 0 })
    expect(
      splitLeading(
        asList({ label: 'x' }, (p: { a: number }) => ({ c: p.a })),
        { a: 1 },
        view
      )
    ).toEqual({
      base: [],
      propsFrom: 1,
    })
  })
})

describe('the argument of the style functions', () => {
  it('is one object for every function of the list, with the props and the theme', () => {
    const seen: object[] = []
    const reader = (props: { theme: unknown }) => {
      seen.push(props)
      return { c: props.theme === view ? 1 : 0 }
    }
    splitLeading(asList(reader, { a: 1 }, reader), { tone: 'red' }, view)
    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(seen[1])
  })

  it('is frozen with an owner, and a write into it is thrown again naming the owner', () => {
    const writer = (props: Record<string, unknown>) => {
      props.tone = 'blue'
      return false as const
    }
    expect(() =>
      splitLeading(asList(writer), { tone: 'red' }, view, '[x] A style function of "Box"')
    ).toThrow(
      /^\[x\] A style function of "Box" threw a TypeError of a write into a frozen object: .*Copy the argument before changing it: const own = \{ \.\.\.props \}\.$/
    )
    expect(splitLeading(asList(writer), { tone: 'red' }, view).propsFrom).toBe(0)
  })

  it('is made frozen only when asked to', () => {
    expect(Object.isFrozen(createStyleArgument({ a: 1 }, view, true))).toBe(true)
    expect(createStyleArgument({ a: 1 }, view, false)).toEqual({ a: 1, theme: view })
    expect(Object.isFrozen(createStyleArgument({ a: 1 }, view, false))).toBe(false)
  })
})

describe('callCheckedStyle', () => {
  const frozen = Object.freeze({ tone: 'red' })

  it('gives the result of the function', () => {
    expect(
      callCheckedStyle((props: typeof frozen) => ({ color: props.tone }), frozen, 'x')
    ).toEqual({
      color: 'red',
    })
  })

  it('throws a write into a frozen object again, the first error as its cause', () => {
    let thrown: unknown
    try {
      callCheckedStyle(
        (props: Record<string, unknown>) => {
          delete props.tone
          return null
        },
        frozen,
        '[x] A style function'
      )
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(TypeError)
    expect((thrown as TypeError).message).toMatch(
      /^\[x\] A style function threw a TypeError of a write into a frozen object: Cannot delete property 'tone'/
    )
    expect((thrown as TypeError).cause).toBeInstanceOf(TypeError)
  })

  it('throws any other error as it is', () => {
    const other = new TypeError('Cannot read properties of undefined')
    const range = new RangeError('read-only range')
    for (const error of [other, range]) {
      expect(() =>
        callCheckedStyle(
          () => {
            throw error
          },
          frozen,
          'x'
        )
      ).toThrow(error)
    }
  })
})
