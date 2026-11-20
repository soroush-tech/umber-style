import { render } from '@testing-library/react'
import { createElement } from 'react'
import * as entry from './index'

describe('the entry of @umber-style/react-native', () => {
  it('exports the default style, createStyle and alpha', () => {
    for (const name of [
      'styled',
      'ThemeProvider',
      'ThemeScope',
      'useThemeClass',
      'ThemeContext',
      'useTheme',
      'StyleSheet',
      'useStyle',
      'apply',
      'themeClass',
      'when',
      'whenScheme',
      'keyframes',
      'globalStyles',
      'Global',
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

  it('configures the default style once, before it is used, and makes keyframes and global styles before it', () => {
    const fade = entry.keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    expect(fade).toMatch(/^fade-[a-z0-9]+$/)
    expect(entry.globalStyles({ body: { margin: 0 } }).id).toMatch(/^global-/)
    entry.configure({ theme: { palette: { primary: 'red' }, space: [0, 4] } })
    expect(entry.themeClass({}, 'dark')).toBe('')
    expect(() => entry.configure({})).toThrow()
  })

  it('has a Global that renders nothing', () => {
    const { container } = render(createElement(entry.Global, { styles: { body: { margin: 0 } } }))
    expect(container.innerHTML).toBe('')
  })
})
