import { createCache, createMemorySheet, NO_THEME_MESSAGE } from '@umber-style/core'
import { createDefaultStyle } from './defaultStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff', onPrimary: '#ffffff' }, space: [0, 4] }

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

  it('makes keyframes and global styles before configure, and renders them through Global', async () => {
    const style = createDefaultStyle()
    const fade = style.keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const base = style.globalStyles((view) => ({ body: { color: view.palette.primary } }))
    style.configure({ prefix: 'k', theme })
    const tree = await resolveTree(
      <style.Global styles={[base, { i: { animation: `${fade} 1s` } }]} />
    )
    expect(findAll(tree, 'style').map((element) => element.props.href)).toEqual([
      expect.stringMatching(/^k-global-/),
      fade,
      expect.stringMatching(/^k-global-/),
    ])
  })

  it('has a sheet, useStyle, apply and themeClass, and the base theme of configure', () => {
    const { configure, StyleSheet, useStyle, apply, themeClass, when, whenScheme, readTheme } =
      createDefaultStyle()
    configure({ theme })
    const classes = useStyle(StyleSheet.create((view) => ({ box: { padding: view.space[1] } })))
    expect(apply(classes.box).className).toMatch(/^css-/)
    expect(themeClass(theme)).toMatch(/^css-theme-[a-z0-9]+ css-boundary$/)
    expect(when(theme)).toMatch(/^@theme css-theme-/)
    expect(whenScheme('dark')).toBe('@scheme dark')
    expect(readTheme()).toBe(theme)
  })

  it('throws from configure once it was used, and shares the engine it is given', () => {
    const { configure, getEngine } = setup()
    getEngine()
    expect(() => configure({ prefix: 'late' })).toThrow('before the default style is used')
  })
})
