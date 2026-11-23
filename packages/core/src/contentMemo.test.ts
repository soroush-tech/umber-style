// @vitest-environment node
import { alpha } from './alpha'
import { CONTENT_STEP_LIMIT, createContentMemo, readStableStyle } from './contentMemo'
import { createLiveValue } from './liveValue'
import type { StyleObject } from './serialize'

/** A memo that remembers each of `styles` under the class `c<index>`, and what it finds for `style`. */
function rememberAll(styles: StyleObject[]) {
  const memo = createContentMemo()
  styles.forEach((style, index) => memo.remember('components', '', style, `c${index}`))
  return (style: StyleObject) => memo.find('components', '', style)
}

describe('createContentMemo', () => {
  it('finds a style of equal contents in a new object, and nothing for other contents', () => {
    const find = rememberAll([{ color: 'red', padding: 8 }])
    expect(find({ color: 'red', padding: 8 })).toBe('c0')
    expect(find({ color: 'red' })).toBeUndefined()
    expect(find({ color: 'red', padding: 8, margin: 0 })).toBeUndefined()
    expect(find({ color: 'blue', padding: 8 })).toBeUndefined()
  })

  it('tells a number from the string of its text, and finds each as it was remembered', () => {
    const pairs: [StyleObject, StyleObject][] = [
      [{ width: 1 }, { width: '1' }],
      [{ width: 0 }, { width: '0' }],
      [{ width: 1.5 }, { width: '1.5' }],
      [{ width: 1 }, { width: ' 1 ' }],
      [{ width: Number.NaN }, { width: 'NaN' }],
    ]
    for (const [number, text] of pairs) {
      const find = rememberAll([number, text])
      expect([find({ ...number }), find({ ...text })]).toEqual(['c0', 'c1'])
    }
  })

  it('finds a number by its value: 1.0 is 1, and -0 is 0, which the compiler writes the same', () => {
    const find = rememberAll([{ width: 1, margin: 0 }])
    expect(find({ width: 1.0, margin: -0 })).toBe('c0')
  })

  it('tells keys in another order apart', () => {
    const find = rememberAll([{ margin: 0, marginLeft: 4 }])
    expect(find({ margin: 0, marginLeft: 4 })).toBe('c0')
    expect(find({ marginLeft: 4, margin: 0 })).toBeUndefined()
  })

  it('joins no text, so a value that looks like more declarations is one value', () => {
    const find = rememberAll([{ a: 'b;c:d' }, { a: 'b', c: 'd' }, { a: '' }, { 'a;c': 'd' }])
    expect(find({ a: 'b;c:d' })).toBe('c0')
    expect(find({ a: 'b', c: 'd' })).toBe('c1')
    expect(find({ a: '' })).toBe('c2')
    expect(find({ 'a;c': 'd' })).toBe('c3')
    expect(find({ a: 'b;c', c: 'd' })).toBeUndefined()
  })

  it('tells a nested style from keys of the same names at the top', () => {
    const find = rememberAll([
      { '&:hover': { color: 'red' }, margin: 0 },
      { '&:hover': {}, color: 'red', margin: 0 },
      { '&:hover': { color: 'red', margin: 0 } },
    ])
    expect(find({ '&:hover': { color: 'red' }, margin: 0 })).toBe('c0')
    expect(find({ '&:hover': {}, color: 'red', margin: 0 })).toBe('c1')
    expect(find({ '&:hover': { color: 'red', margin: 0 } })).toBe('c2')
    expect(find({ color: 'red', margin: 0 })).toBeUndefined()
  })

  it('keeps a style apart for each layer and each class it is made after', () => {
    const memo = createContentMemo()
    const style = { color: 'red' }
    memo.remember('components', '', style, 'a')
    memo.remember('overrides', '', style, 'b')
    memo.remember('components', 'x', style, 'c')
    expect(memo.find('components', '', { color: 'red' })).toBe('a')
    expect(memo.find('overrides', '', { color: 'red' })).toBe('b')
    expect(memo.find('components', 'x', { color: 'red' })).toBe('c')
    expect(memo.find('components', 'y', { color: 'red' })).toBeUndefined()
  })

  it('remembers a style with no rule as the empty class', () => {
    const find = rememberAll([{}])
    expect(find({})).toBe('c0')
  })

  it('finds nothing for values it does not read, even the objects it was given', () => {
    const live = createLiveValue('--l', 1)
    const list = ['block', 'grid']
    const find = rememberAll([{ color: 'red' }])
    for (const value of [alpha('#ff0000', 0.5), live, list, () => 'red', true]) {
      expect(find({ color: value } as unknown as StyleObject)).toBeUndefined()
    }
  })

  it('is emptied when it holds the most steps it may, and goes on remembering', () => {
    const memo = createContentMemo()
    memo.remember('components', '', { left: -1 }, 'first')
    for (let index = 0; memo.size < CONTENT_STEP_LIMIT; index++) {
      memo.remember('components', '', { left: index }, `c${index}`)
    }
    expect(memo.find('components', '', { left: -1 })).toBe('first')
    memo.remember('components', '', { top: 1 }, 'later')
    expect(memo.size).toBeLessThan(CONTENT_STEP_LIMIT)
    expect(memo.find('components', '', { left: -1 })).toBeUndefined()
    expect(memo.find('components', '', { top: 1 })).toBe('later')
  })
})

describe('readStableStyle', () => {
  it('is the style itself when every value is plain', () => {
    const style = { color: 'red', padding: 8, label: 'Box' }
    expect(readStableStyle(style)).toBe(style)
  })

  it('copies nested styles, in their order, with the values that write nothing', () => {
    const hover = { color: 'red', opacity: undefined, margin: null, padding: false }
    const style = { display: 'flex', '&:hover': hover, gap: 4, '@media (x)': { '&:focus': {} } }
    const stable = readStableStyle(style as StyleObject) as StyleObject
    expect(stable).toEqual(style)
    expect(Object.keys(stable)).toEqual(Object.keys(style))
    expect(stable['&:hover']).not.toBe(hover)
  })

  it('copies a nested style made with no prototype', () => {
    const hover = Object.assign(Object.create(null) as StyleObject, { color: 'red' })
    expect(readStableStyle({ '&:hover': hover })).toEqual({ '&:hover': { color: 'red' } })
  })

  it('reads nothing it cannot copy as it is', () => {
    const live = createLiveValue('--l', 1)
    class Box {
      color = 'red'
    }
    const unreadable: unknown[] = [
      alpha('#ff0000', 0.5),
      live,
      ['block', 'grid'],
      () => 'red',
      true,
      new Box(),
      { toString: () => 'red' },
      { '&:hover': [1] },
      JSON.parse('{"__proto__":{"color":"red"}}'),
    ]
    for (const value of unreadable) {
      expect(readStableStyle({ color: 'red', '&:hover': value } as unknown as StyleObject)).toBe(
        undefined
      )
    }
  })

  it('calls no getter of a nested style, and reads no style that has one', () => {
    const read = vi.fn(() => 'red')
    const hover = Object.defineProperty({}, 'color', { get: read, enumerable: true })
    expect(readStableStyle({ '&:hover': hover })).toBeUndefined()
    const memo = createContentMemo()
    memo.remember('components', '', { '&:hover': { color: 'red' } }, 'a')
    expect(memo.find('components', '', { '&:hover': hover })).toBeUndefined()
    expect(read).not.toHaveBeenCalled()
  })
})
