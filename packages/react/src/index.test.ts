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
      'multiply',
      'divide',
      'add',
      'subtract',
      'negate',
    ]) {
      expect(entry).toHaveProperty(name)
    }
    expect(String(entry.alpha('red', 0.5))).toBe('color-mix(in srgb, red 50%, transparent)')
    expect(entry.multiply('var(--x)', 2)).toBe('calc(var(--x) * 2)')
  })

  it('configures the default engine once, before it is used', () => {
    entry.configure({ prefix: 'idx', theme: { palette: { primary: 'red' } } })
    expect(entry.getEngine().cache.prefix).toBe('idx')
    expect(() => entry.configure({ prefix: 'again' })).toThrow()
  })
})
