import { createSheetEntry, flattenStyle, isSheetEntry } from './sheetEntry'

describe('createSheetEntry', () => {
  it('makes a frozen object with the class name, that prints as it', () => {
    const entry = createSheetEntry('a-1')
    expect(entry.className).toBe('a-1')
    expect(Object.isFrozen(entry)).toBe(true)
    expect(`${entry}`).toBe('a-1')
  })

  it('has one enumerable key, which survives a merge of style objects', () => {
    const merged = { ...createSheetEntry('a'), ...createSheetEntry('b') }
    expect(Object.keys(merged)).toEqual(['--umber-entry-a', '--umber-entry-b'])
    expect(flattenStyle(merged).map(String)).toEqual(['a', 'b'])
  })

  it('holds nothing a plain element would write: every enumerable value is null', () => {
    expect(Object.values(createSheetEntry('a'))).toEqual([null])
    expect(Object.getOwnPropertySymbols(createSheetEntry('a'))).toHaveLength(1)
  })
})

describe('isSheetEntry', () => {
  it('knows an entry from a string, a style object and nothing', () => {
    expect(isSheetEntry(createSheetEntry('a'))).toBe(true)
    expect(isSheetEntry({ className: 'a' })).toBe(false)
    expect(isSheetEntry('a')).toBe(false)
    expect(isSheetEntry(null)).toBe(false)
    expect(isSheetEntry(undefined)).toBe(false)
  })
})

describe('flattenStyle', () => {
  it('flattens nested arrays, drops what is empty, and keeps entries and plain objects in order', () => {
    const a = createSheetEntry('a')
    const b = createSheetEntry('b')
    const flat = flattenStyle([
      { opacity: 1 },
      a,
      [false, null, undefined, '', 0, [b]],
      { color: 'red' },
    ])
    expect(flat).toEqual([{ opacity: 1 }, a, b, { color: 'red' }])
  })

  it('splits an object that holds entries and plain keys together: its entries, then the rest', () => {
    const flat = flattenStyle({ ...createSheetEntry('a'), opacity: 1 })
    expect(flat.map((item) => (isSheetEntry(item) ? item.className : item))).toEqual([
      'a',
      { opacity: 1 },
    ])
  })

  it('gives nothing for nothing', () => {
    expect(flattenStyle(undefined)).toEqual([])
    expect(flattenStyle([])).toEqual([])
  })

  it('throws for a string, which cannot be merged into a class', () => {
    expect(() => flattenStyle('width: 3px')).toThrow('cannot be merged into a class')
    expect(() => flattenStyle(['a', createSheetEntry('b')])).toThrow('string')
  })
})
