import * as entry from './index'

describe('the entry of @umber-style/react', () => {
  it('exports the default style, createStyle and alpha', () => {
    for (const name of [
      'styled',
      'ThemeProvider',
      'useTheme',
      'StyleSheet',
      'useStyle',
      'apply',
      'themeClass',
      'getEngine',
      'configure',
      'createStyle',
      'alpha',
    ]) {
      expect(entry).toHaveProperty(name)
    }
    expect(entry.alpha('red', 0.5)).toBe('color-mix(in srgb, red 50%, transparent)')
  })

  it('configures the default engine once, before it is used', () => {
    entry.configure({ prefix: 'idx', theme: { palette: { primary: 'red' } } })
    expect(entry.getEngine().cache.prefix).toBe('idx')
    expect(() => entry.configure({ prefix: 'again' })).toThrow()
  })
})
