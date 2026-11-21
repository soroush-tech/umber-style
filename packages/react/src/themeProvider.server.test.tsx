import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { findAll, resolveTree } from './vitest.resolveTree'
import { playScopes } from './vitest.providerScope'

const theme = { palette: { primary: '#0000ff', text: '#111111' } }

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const engine = createEngine(theme, {
    prefix: 'q',
    cache: createCache({ prefix: 'q', sheet: createMemorySheet() }),
  })
  return bindEngine(engine, requestCache)
}

describe('the outermost provider of the server build', () => {
  it('renders no element and sends the rule of its theme on :root', async () => {
    const { ThemeProvider, useTheme } = setup()
    const tree = playScopes(
      await resolveTree(
        <ThemeProvider theme={{ palette: { text: '#222222' } }} colorScheme="dark">
          <i />
        </ThemeProvider>
      )
    )
    expect(findAll(tree, 'div')).toEqual([])
    const [root] = findAll(tree, 'style')
    expect(root.props.href).toMatch(/^q-root-/)
    expect(root.children[0]).toContain(
      // The base theme, then the theme given, which wins where both declare a variable.
      ':where(:root){--q-palette-primary:#0000ff;--q-palette-text:#111111;--q-palette-text:#222222;color-scheme:dark;}'
    )
    // A server component reads the base theme, not the theme of the provider.
    expect(useTheme().palette.text).toBe('#111111')
  })

  it('calls a function theme with the base theme, outermost and nested alike', async () => {
    const { ThemeProvider } = setup()
    const tree = playScopes(
      await resolveTree(
        <ThemeProvider theme={(outer) => ({ palette: { text: outer.palette.primary } })}>
          <ThemeProvider theme={(outer) => ({ palette: { primary: outer.palette.text } })}>
            <i />
          </ThemeProvider>
        </ThemeProvider>
      )
    )
    const texts = findAll(tree, 'style').map((element) => element.children[0] as string)
    expect(texts[0]).toContain(
      ':where(:root){--q-palette-primary:#0000ff;--q-palette-text:#111111;--q-palette-text:#0000ff;}'
    )
    // The nested one gets the base theme too, not the theme of the provider above it.
    expect(texts[1]).toMatch(/\.q-theme-\w+\{--q-palette-primary:#111111;\}/)
    expect(findAll(tree, 'div')[0].props.className).toMatch(/^q-theme-\w+ q-boundary q-scope$/)
  })
})
