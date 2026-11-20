import * as entry from './index.server'

describe('the server entry of @umber-style/react', () => {
  it('exports the default style, createStyle and alpha, and readTheme instead of useTheme', () => {
    for (const name of [
      'styled',
      'ThemeProvider',
      'readTheme',
      'StyleSheet',
      'useStyle',
      'apply',
      'css',
      'themeClass',
      'when',
      'whenScheme',
      'keyframes',
      'globalStyles',
      'Global',
      'getEngine',
      'configure',
      'createStyle',
      'alpha',
      'multiply',
      'divide',
      'add',
      'subtract',
      'negate',
      'at',
    ]) {
      expect(entry).toHaveProperty(name)
    }
    for (const name of ['useTheme', 'ThemeScope', 'useThemeClass', 'ThemeContext']) {
      expect(entry).not.toHaveProperty(name)
    }
  })

  it('configures the default engine once, before it is used', () => {
    entry.configure({
      prefix: 'srv',
      theme: { palette: { primary: 'red', onPrimary: 'white' }, space: [0, 4] },
    })
    expect(entry.getEngine().cache.prefix).toBe('srv')
    expect(() => entry.configure({ prefix: 'again' })).toThrow()
  })
})
