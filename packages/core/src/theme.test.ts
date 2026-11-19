import { createCache, createMemorySheet } from './cache'
import { createThemeClass } from './theme'

describe('createThemeClass', () => {
  it('gives the same declarations the same class and one rule', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ hasLayers: false, hasPruning: false, prefix: 'ds', sheet })
    const first = createThemeClass(cache, { '--a': 'b', '--c': 'd' })
    const second = createThemeClass(cache, { '--a': 'b', '--c': 'd' })
    expect(second).toBe(first)
    expect(first).toMatch(/^ds-theme-[a-z0-9]+$/)
    expect(sheet.rules).toEqual([`.${first}{--a:b;--c:d;}`])
    expect(cache.registered.size).toBe(0)
  })

  it('gives different declarations a different class', () => {
    const cache = createCache({ hasLayers: false, sheet: createMemorySheet() })
    expect(createThemeClass(cache, { '--a': 'b' })).not.toBe(
      createThemeClass(cache, { '--a': 'c' })
    )
  })

  it('sets color-scheme in the rule', () => {
    const sheet = createMemorySheet()
    const className = createThemeClass(
      createCache({ hasLayers: false, hasPruning: false, sheet }),
      { '--a': 'b' },
      { colorScheme: 'dark' }
    )
    expect(sheet.rules).toEqual([`.${className}{--a:b;color-scheme:dark;}`])
  })
})

describe('createThemeClass for a theme with no variable', () => {
  it('returns a class and inserts no rule, as a theme of raw values only declares nothing', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ hasLayers: false, prefix: 't', sheet })
    const className = createThemeClass(cache, {})
    expect(className).toMatch(/^t-theme-/)
    expect(sheet.rules).toEqual([])
    expect(cache.getRules(className)).toEqual([])
  })
})
