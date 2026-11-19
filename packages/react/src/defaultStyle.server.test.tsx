import { createCache, createMemorySheet, NO_THEME_MESSAGE } from '@umber-style/core'
import { createDefaultStyle } from './defaultStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4] }

function setup() {
  const style = createDefaultStyle()
  const sheet = createMemorySheet()
  style.configure({ prefix: 'd', cache: createCache({ prefix: 'd', sheet }) })
  return { ...style, sheet }
}

describe('the default style for server components', () => {
  it('has styled run before any theme, and renders its classes and style elements', async () => {
    const { styled, ThemeProvider, getEngine, readTheme } = setup()
    const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    expect(getEngine().hasTheme).toBe(false)
    expect(() => readTheme()).toThrow(NO_THEME_MESSAGE)
    const tree = await resolveTree(
      <ThemeProvider theme={theme}>
        <Box />
      </ThemeProvider>
    )
    expect(getEngine().baseTheme).toBe(theme)
    expect(findAll(tree, 'div').map((element) => element.props.className)).toEqual([
      expect.stringMatching(/^d-theme-/),
      expect.stringMatching(/^d-box-root-/),
    ])
    expect(findAll(tree, 'style')).toHaveLength(3)
  })

  it('has a sheet, useStyle, apply and themeClass, and the base theme of configure', () => {
    const { configure, StyleSheet, useStyle, apply, themeClass, readTheme } = createDefaultStyle()
    configure({ theme })
    const classes = useStyle(StyleSheet.create((view) => ({ box: { padding: view.space[1] } })))
    expect(apply(classes.box).className).toMatch(/^css-/)
    expect(themeClass(theme)).toMatch(/^css-theme-/)
    expect(readTheme()).toBe(theme)
  })

  it('throws from configure once it was used, and shares the engine it is given', () => {
    const { configure, getEngine } = setup()
    getEngine()
    expect(() => configure({ prefix: 'late' })).toThrow('before the default style is used')
  })
})
