import {
  cellStyle,
  createFixedStyle,
  createSheetEntries,
  createLayoutKey,
  KINDS,
  LABELS,
  LAYOUT_PROPS,
  themedStyle,
  TONES,
} from './components'
import { createCombinations } from './styles'
import { createSmallTheme } from './themes'

describe('the components of the binding benchmarks', () => {
  it('names each of the five kinds', () => {
    expect(KINDS).toHaveLength(5)
    expect(Object.keys(LABELS)).toEqual([...KINDS])
  })

  it('keeps the six layout props, and tells the 48 combinations apart by key', () => {
    const combinations = createCombinations(48)
    expect([...LAYOUT_PROPS].sort()).toEqual(Object.keys(combinations[0]).sort())
    expect(new Set(combinations.map(createLayoutKey)).size).toBe(48)
    expect(createLayoutKey(combinations[0])).toBe('0|row|flex-start|flex-start|nowrap')
  })

  it('has four tones', () => {
    expect(TONES).toEqual(['a', 'b', 'c', 'd'])
  })

  it('makes the web styles, fresh each time, and reads the theme in its functions', () => {
    const theme = createSmallTheme()
    expect(createFixedStyle()).toEqual({ display: 'flex', padding: 8, color: 'red' })
    expect(createFixedStyle()).not.toBe(createFixedStyle())
    expect(themedStyle({ theme })).toEqual({ color: '#1b5fd1', padding: 8, borderRadius: 4 })
    expect(cellStyle({ theme })).toEqual({ color: '#1a1a1a', padding: 4 })
    expect(createSheetEntries()).toEqual({
      root: { margin: 4, outline: '1px solid blue' },
      other: { margin: 8 },
    })
    expect(createSheetEntries()).not.toBe(createSheetEntries())
  })
})
