import { mergeStyles, type StyleObject } from './serialize'

describe('mergeStyles: the order of the keys', () => {
  it('moves a key written again to the end, each time it is written', () => {
    const merged = mergeStyles([{ a: 1, b: 2, c: 3 }, { a: 4 }, { b: 5 }, { a: 6 }])
    expect(Object.entries(merged)).toEqual([
      ['c', 3],
      ['b', 5],
      ['a', 6],
    ])
  })

  it('moves a nested style merged again to the end, with its keys in their merged order', () => {
    const merged = mergeStyles([{ '&:hover': { x: 1, y: 2 }, z: 1 }, { '&:hover': { x: 3 } }])
    expect(Object.keys(merged)).toEqual(['z', '&:hover'])
    expect(Object.entries(merged['&:hover'] as object)).toEqual([
      ['y', 2],
      ['x', 3],
    ])
  })

  it('moves a label joined with a later one to the end', () => {
    const merged = mergeStyles([{ label: 'Box', color: 'red' }, { label: 'Inner' }])
    expect(Object.entries(merged)).toEqual([
      ['color', 'red'],
      ['label', 'Box-Inner'],
    ])
  })

  it('moves nothing for a value that declares nothing, and moves a key written after it', () => {
    const styles: StyleObject[] = [{ a: 1, b: 2 }, { a: undefined, b: false }, { b: null }]
    expect(Object.keys(mergeStyles(styles))).toEqual(['a', 'b'])
    expect(Object.keys(mergeStyles([...styles, { a: 3 }]))).toEqual(['b', 'a'])
  })

  it('keeps the keys of integers first, in their order, as every object does', () => {
    const merged = mergeStyles([
      { b: 1, 2: 'x', 1: 'y' },
      { b: 2, 1: 'z' },
    ])
    expect(Object.entries(merged)).toEqual([
      ['1', 'z'],
      ['2', 'x'],
      ['b', 2],
    ])
  })
})
