import { alpha, createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { palette: { primary: '#0000ff', surface: '#ffffff' } }

const ORDER = '@layer p-theme,p-global,p-components,p-overrides;'
const PRIMARY =
  '@property --p-palette-primary{syntax:"<color>";inherits:true;initial-value:#0000ff;}'

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup(options: { hasColorFallbacks?: boolean } = {}) {
  const engine = createEngine(theme, {
    prefix: 'p',
    registered: { 'palette.primary': true },
    cache: createCache({ prefix: 'p', sheet: createMemorySheet(), ...options }),
  })
  const style = bindEngine(engine, requestCache)
  const Box = style.styled('div')(({ theme: view }) => ({
    background: alpha(view.palette.primary, 0.1),
  }))
  return { ...style, Box }
}

describe('registered properties in the server build', () => {
  it('sends the @property rule with the element of the theme class, after the order and before the rule', async () => {
    const { ThemeProvider } = setup()
    const tree = await resolveTree(<ThemeProvider theme={theme}>x</ThemeProvider>)
    const [themeElement] = findAll(tree, 'style')
    const [text] = themeElement.children as string[]
    expect(text.startsWith(`${ORDER}${PRIMARY}@layer p-theme{.p-theme-`)).toBe(true)
    expect(text).toContain('--p-palette-primary:#0000ff;')
    expect(text.match(/@property/g)).toHaveLength(1)
  })

  it('sends it for a root provider too, and not with the element of a component class', async () => {
    const { ThemeProvider, Box, themeClass } = setup()
    // The app makes the rule of the class it puts on <html>; a root provider only sends it.
    themeClass(theme)
    const tree = await resolveTree(
      <ThemeProvider theme={theme} isRoot>
        <Box />
      </ThemeProvider>
    )
    const texts = findAll(tree, 'style').map((element) => (element.children as string[])[0])
    expect(texts.filter((text) => text.includes('@property'))).toHaveLength(1)
    const boxRule = texts.find((text) => text.includes('color-mix'))
    expect(boxRule).toContain('background:var(--p-palette-primary);background:color-mix(')
  })

  it('writes the mix alone in the element of a component without color fallbacks', async () => {
    const { Box } = setup({ hasColorFallbacks: false })
    const tree = await resolveTree(<Box />)
    const [text] = findAll(tree, 'style').map((element) => (element.children as string[])[0])
    expect(text).toContain(
      '{background:color-mix(in srgb, var(--p-palette-primary) 10%, transparent);}'
    )
    expect(text).not.toContain('background:var(--p-palette-primary);')
  })
})
