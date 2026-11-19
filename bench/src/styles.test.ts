import {
  createCombinations,
  createCycle,
  createDistinctStyles,
  createLargeStyle,
  createLayoutStyle,
  createSmallStyle,
} from './styles'

/** The declarations in `style` and, below it, in its nested rules. */
function countDeclarations(style: object): number {
  return Object.values(style).reduce<number>(
    (total, value) =>
      total + (typeof value === 'object' && value !== null ? countDeclarations(value) : 1),
    0
  )
}

describe('the benchmark styles', () => {
  it('has a small style and a large one that nests', () => {
    expect(countDeclarations(createSmallStyle())).toBe(5)
    const large = createLargeStyle()
    expect(countDeclarations(large)).toBeGreaterThan(50)
    expect(Object.keys(large).filter((key) => key.startsWith('@')).length).toBeGreaterThan(2)
    expect(Object.keys(large).filter((key) => key.startsWith('&')).length).toBeGreaterThan(1)
  })

  it('makes the layout style from its six props', () => {
    const [first] = createCombinations(1)
    expect(createLayoutStyle(first)).toEqual({
      gap: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      padding: 0,
    })
  })

  it('makes N distinct combinations, the same ones every time', () => {
    for (const count of [1, 16, 48, 100]) {
      const combinations = createCombinations(count)
      expect(combinations).toHaveLength(count)
      expect(new Set(combinations.map((props) => JSON.stringify(props))).size).toBe(count)
    }
    expect(createCombinations(48)).toEqual(createCombinations(48))
    expect(new Set(createCombinations(48).map((props) => props.gap))).toEqual(new Set([0, 4, 8]))
  })

  it('makes distinct styles, and tags them when asked', () => {
    const pool = createDistinctStyles(20)
    expect(new Set(pool.map((style) => JSON.stringify(style))).size).toBe(20)
    expect(createDistinctStyles(2, 'x')[1].margin).toBe('1px x')
  })

  it('cycles a pool and tells when it comes back to the start', () => {
    let wraps = 0
    const next = createCycle(['a', 'b'], () => wraps++)
    expect([next(), next(), next(), next(), next()]).toEqual(['a', 'b', 'a', 'b', 'a'])
    expect(wraps).toBe(2)
    const quiet = createCycle([1])
    expect([quiet(), quiet()]).toEqual([1, 1])
  })
})
