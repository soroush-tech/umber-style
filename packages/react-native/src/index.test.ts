import * as entry from './index'

describe('the entry of @umber-style/react-native', () => {
  it('exports the default style, createStyle and alpha', () => {
    for (const name of [
      'styled',
      'ThemeProvider',
      'useTheme',
      'StyleSheet',
      'useStyle',
      'apply',
      'themeClass',
      'when',
      'whenScheme',
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
    expect(entry.alpha('#fff', 1)).toBe('#fff')
    expect(entry.alpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(entry.multiply(8, 2)).toBe(16)
  })

  it('configures the default style once, before it is used', () => {
    entry.configure({ theme: { palette: { primary: 'red' }, space: [0, 4] } })
    expect(entry.themeClass({}, 'dark')).toBe('')
    expect(() => entry.configure({})).toThrow()
  })
})
