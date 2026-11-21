import { createCache, createMemorySheet, EMPTY_THEME } from '@umber-style/core'
import { createDefaultStyle } from './defaultStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'
import { playScopes } from './vitest.providerScope'

const theme = { palette: { primary: '#0000ff', onPrimary: '#ffffff' }, space: [0, 4] }

function setup() {
  const style = createDefaultStyle()
  const sheet = createMemorySheet()
  style.configure({ prefix: 'd', cache: createCache({ prefix: 'd', sheet }) })
  return { ...style, sheet }
}

describe('the default style for server components', () => {
  it('has styled run with no base theme, and a provider does not give one', async () => {
    const { styled, ThemeProvider, getEngine, useTheme } = setup()
    const Box = styled('div', { name: 'Box' })({ color: 'red' })
    expect(getEngine().hasTheme).toBe(false)
    expect(useTheme()).toBe(EMPTY_THEME)
    const tree = playScopes(
      await resolveTree(
        <ThemeProvider theme={theme}>
          <Box />
        </ThemeProvider>
      )
    )
    expect(getEngine().hasTheme).toBe(false)
    // The outermost provider renders no element: one style element for its root theme, one for the Box.
    expect(findAll(tree, 'div').map((element) => element.props.className)).toEqual([
      expect.stringMatching(/^d-box-root-/),
    ])
    expect(findAll(tree, 'style').map((element) => element.props.href)).toEqual([
      expect.stringMatching(/^d-root-/),
      expect.stringMatching(/^d-box-root-/),
    ])
  })

  it('makes keyframes and global styles before configure, and renders them through Global', async () => {
    const style = createDefaultStyle()
    const fade = style.keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const base = style.globalStyles((view) => ({ body: { color: view.palette.primary } }))
    style.configure({ prefix: 'k', theme })
    const tree = playScopes(
      await resolveTree(<style.Global styles={[base, { i: { animation: `${fade} 1s` } }]} />)
    )
    expect(findAll(tree, 'style').map((element) => element.props.href)).toEqual([
      expect.stringMatching(/^k-global-/),
      fade,
      expect.stringMatching(/^k-global-/),
    ])
  })

  it('makes css() values before configure, with the options given later', async () => {
    const style = createDefaultStyle()
    const card = style.css({ padding: 8 })
    const sheet = createMemorySheet()
    style.configure({ prefix: 'late', cache: createCache({ prefix: 'late', sheet }) })
    const Box = style.styled('div')`margin: 0;`
    const tree = playScopes(await resolveTree(<Box style={card} />))
    const [, override] = (findAll(tree, 'div')[0].props.className as string).split(' ')
    expect(override).toMatch(/^late-/)
    expect(sheet.rules).toContain(`@layer late-overrides{.${override}{padding:8px;}}`)
  })

  it('has a sheet, useStyle, apply and themeClass, and the base theme of configure', () => {
    const { configure, StyleSheet, useStyle, apply, themeClass, when, whenScheme, useTheme } =
      createDefaultStyle()
    configure({ theme })
    const classes = useStyle(StyleSheet.create((view) => ({ box: { padding: view.space[1] } })))
    expect(apply(classes.box).className).toMatch(/^css-/)
    expect(themeClass(theme)).toMatch(/^css-theme-[a-z0-9]+ css-boundary$/)
    expect(when(theme)).toMatch(/^@theme css-theme-/)
    expect(whenScheme('dark')).toBe('@scheme dark')
    expect(useTheme()).toBe(theme)
  })

  it('has its tag shorthands as own members: copying them uses nothing, so configure still works', async () => {
    const style = createDefaultStyle()
    const wrapper = Object.assign(() => null, style.styled)
    const sheet = createMemorySheet()
    style.configure({ prefix: 'late', cache: createCache({ prefix: 'late', sheet }) })
    const Box = wrapper.div({ margin: 0 })
    const tree = playScopes(await resolveTree(<Box />))
    expect(findAll(tree, 'div')[0].props.className).toMatch(/^late-/)
  })

  it('throws from configure once it was used, and shares the engine it is given', () => {
    const { configure, getEngine } = setup()
    getEngine()
    expect(() => configure({ prefix: 'late' })).toThrow('before the default style is used')
  })
})
