import * as entry from './index'

describe('the entry of @umber-style/vue', () => {
  it('exports the default style and createStyle', () => {
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
      'getEngine',
      'configure',
      'createStyle',
    ]) {
      expect(entry).toHaveProperty(name)
    }
  })

  it('configures the default engine once, before it is used', () => {
    entry.configure({ prefix: 'idx' })
    expect(entry.getEngine().cache.prefix).toBe('idx')
    expect(() => entry.configure({ prefix: 'again' })).toThrow()
  })
})
