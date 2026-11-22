import { render } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createDefaultStyle } from './defaultStyle'
import { createUnconfiguredMessage } from './watchProvidedCaches'

const light = { palette: { primary: '#0000ff', onPrimary: '#ffffff' }, space: [0, 4, 8] }

/** A cache of the key `key` over an in-memory sheet. */
const createKeyed = (key: string) => createCache({ prefix: key, sheet: createMemorySheet() })

/** Renders a styled component and a `Global` of `style` under a provider of `cache`, twice. */
function renderUnder(
  style: ReturnType<typeof createDefaultStyle>,
  cache: ReturnType<typeof createKeyed>
) {
  const Box = style.styled('p', { name: 'Box' })({ margin: 0 })
  const Themed = style.styled('p', { name: 'Themed' })(({ theme }) => ({
    color: theme.palette.primary,
  }))
  for (let round = 0; round < 2; round++) {
    render(
      <CacheProvider value={cache}>
        <style.ThemeProvider theme={light}>
          <style.Global styles={{ body: { margin: 0 } }} />
          <Box />
          <Themed />
        </style.ThemeProvider>
      </CacheProvider>
    )
  }
}

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development')
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('the default style under a cache of another key', () => {
  it('warns once, in development, when it was never configured: both prefixes and the two usual causes', () => {
    renderUnder(createDefaultStyle(), createKeyed('soroush'))
    expect(warn.mock.calls).toEqual([[createUnconfiguredMessage('css', 'soroush')]])
    expect(createUnconfiguredMessage('css', 'soroush')).toBe(
      '[css] A component of the default style rendered under a CacheProvider whose cache has the key "soroush", and the default style was never configured: it still has the prefix "css" and every default option. If it was meant to be configured, configure() did not run before the style was used. The usual causes: a configure() call in a module imported only for its side effect, which a bundler drops when the package says "sideEffects": false; or a configure() call that runs after the first styled() call. Call configure() from a function that the app calls before it renders (or list the module in "sideEffects"), or give the cache the key "css" if the default prefix is meant.'
    )
  })

  it('warns from the first component of the style that renders under the provider, a provider alone too', () => {
    const style = createDefaultStyle()
    render(
      <CacheProvider value={createKeyed('app')}>
        <style.ThemeProvider theme={light} />
      </CacheProvider>
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('the key "app"')
  })

  it('says nothing for a cache of the default prefix: an app that means the default', () => {
    renderUnder(createDefaultStyle(), createKeyed('css'))
    expect(warn).not.toHaveBeenCalled()
  })

  it('says nothing for a configured style, whatever the key of the cache', () => {
    const prefixed = createDefaultStyle()
    prefixed.configure({ prefix: 'soroush' })
    renderUnder(prefixed, createKeyed('other'))
    const themed = createDefaultStyle()
    themed.configure({ theme: light })
    renderUnder(themed, createKeyed('soroush'))
    expect(warn).not.toHaveBeenCalled()
  })

  it('says nothing in production, and outside any provider', () => {
    vi.stubEnv('NODE_ENV', 'production')
    renderUnder(createDefaultStyle(), createKeyed('soroush'))
    vi.stubEnv('NODE_ENV', 'development')
    const style = createDefaultStyle()
    const Box = style.styled('p')({ margin: 0 })
    render(<Box />)
    expect(warn).not.toHaveBeenCalled()
  })
})
