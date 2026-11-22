import { render } from '@testing-library/react'

// Two copies of the binding, each with its own copy of the core, and one React: as an app has them when
// one package is bundled into a build and another is left external.

/** A copy of the binding (and of the core under it), with module state of its own. */
async function loadCopy() {
  vi.resetModules()
  return import('./index')
}

const theme = { palette: { primary: '#0000ff' } }

afterEach(() => {
  document.head.innerHTML = ''
})

describe('two copies of the React binding', () => {
  it('share one default style: a component of one reads the provider of the other', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    expect(second.styled).toBe(first.styled)
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(second.useTheme())
      return null
    }
    render(
      <first.ThemeProvider theme={theme}>
        <Probe />
      </first.ThemeProvider>
    )
    expect(seen).toEqual([theme])
  })

  it('share the contexts of a prefix: a style of one reads the theme and the wrapper of a provider of the other', async () => {
    const first = await loadCopy().then(({ createStyle }) => createStyle(theme, { prefix: 'twin' }))
    const second = await loadCopy().then(({ createStyle }) =>
      createStyle(theme, { prefix: 'twin' })
    )
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(second.useTheme(), second.useThemeClass())
      return null
    }
    const inner = { palette: { primary: '#ff0000' } }
    const { container } = render(
      <first.ThemeProvider theme={theme}>
        <first.ThemeProvider theme={inner}>
          <Probe />
        </first.ThemeProvider>
      </first.ThemeProvider>
    )
    expect(seen).toEqual([inner, container.querySelector('div')?.className])
  })

  it('share the cache provider: a component of one writes into the cache that a provider of the other gives', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    const { createCache, createMemorySheet } = await import('@umber-style/core')
    const cache = createCache({ prefix: 'given', hasLayers: false, sheet: createMemorySheet() })
    const { styled } = second.createStyle(theme, { prefix: 'own' })
    const Box = styled('p')({ margin: 0 })
    const { container } = render(
      <first.CacheProvider value={cache}>
        <Box />
      </first.CacheProvider>
    )
    const className = container.querySelector('p')?.className as string
    expect(className).toMatch(/^given-/)
    expect(cache.extract().css).toBe(`.${className}{margin:0;}`)
  })
})
