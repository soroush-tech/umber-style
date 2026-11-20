// @vitest-environment node
import { createEngine } from './createEngine'
import { createThemeRule, ROOT_SELECTOR } from './theme'

const theme = {
  palette: { primary: '#1b5fd1', text: '#1a1a1a' },
  space: [0, 4],
  breakpoints: ['600px'],
}

describe('readThemeText', () => {
  it('gives every variable of a theme with its real value, and writes nothing', () => {
    const engine = createEngine(theme, { prefix: 'u' })
    const text = engine.readThemeText(theme)
    expect(text.declarations).toBe(
      '--u-palette-primary:#1b5fd1;--u-palette-text:#1a1a1a;--u-space-0:0;--u-space-1:4px;'
    )
    expect(text.names).toEqual([
      '--u-palette-primary',
      '--u-palette-text',
      '--u-space-0',
      '--u-space-1',
    ])
    expect(text.properties).toBe('')
    expect(engine.cache.extract().css).toBe('')
  })

  it('gives only what a partial theme declares, and is made once for each theme object', () => {
    const engine = createEngine(theme, { prefix: 'u' })
    const brand = { palette: { primary: '#2a6f8a' } }
    const text = engine.readThemeText(brand)
    expect(text.declarations).toBe('--u-palette-primary:#2a6f8a;')
    expect(engine.readThemeText(brand)).toBe(text)
    expect(engine.readThemeText({ breakpoints: ['300px'] }).declarations).toBe('')
  })

  it('gives the @property rules of the registered variables among them', () => {
    const engine = createEngine(theme, { prefix: 'u', registered: { 'palette.primary': true } })
    expect(engine.readThemeText({ palette: { primary: '#2a6f8a' } }).properties).toBe(
      '@property --u-palette-primary{syntax:"<color>";inherits:true;initial-value:#1b5fd1;}'
    )
    expect(engine.readThemeText({ palette: { text: '#000' } }).properties).toBe('')
  })
})

describe('createThemeRule', () => {
  it('wraps the rule in the theme layer of the prefix, or not without layers', () => {
    expect(createThemeRule('u', true, ROOT_SELECTOR, '--a:1;')).toBe(
      '@layer u-theme{:where(:root){--a:1;}}'
    )
    expect(createThemeRule('u', false, '.u-theme-x', '--a:1;')).toBe('.u-theme-x{--a:1;}')
  })
})
