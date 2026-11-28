import * as entry from './index.server'

describe('the server entry of @umber-style/react', () => {
  it('exports the default style, createStyle and alpha, and useTheme with readTheme, the same function', () => {
    for (const name of [
      'styled',
      'ThemeProvider',
      'useTheme',
      'readTheme',
      'StyleSheet',
      'useStyle',
      'withTheme',
      'withStyle',
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
    for (const name of ['ThemeScope', 'useThemeClass', 'ThemeContext']) {
      expect(entry).not.toHaveProperty(name)
    }
    expect(entry.readTheme).toBe(entry.useTheme)
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
