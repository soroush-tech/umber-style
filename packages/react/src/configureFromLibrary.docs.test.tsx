import { render } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createDefaultStyle } from './defaultStyle'

// "A library that wraps the engine" in docs/react.md: the library configures the default style from a
// function that the app calls, once, before it renders.
const lightTheme = { palette: { primary: '#1b5fd1', onPrimary: '#ffffff' }, space: [0, 4, 8] }

describe('a library that configures the default style from a function', () => {
  it('gives the prefix and the theme on the first call, does nothing on the next, and warns about nothing', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { configure, styled, getEngine } = createDefaultStyle()
    let isConfigured = false
    function setUpEngine(): void {
      if (isConfigured) return
      isConfigured = true
      configure({ prefix: 'soroush', theme: lightTheme })
    }
    setUpEngine()
    setUpEngine()
    const Box = styled('p', { name: 'Box' })({ margin: 0 })
    const { container } = render(
      <CacheProvider value={createCache({ prefix: 'app', sheet: createMemorySheet() })}>
        <Box />
      </CacheProvider>
    )
    expect(getEngine().cache.prefix).toBe('soroush')
    expect(getEngine().givenTheme).toBe(lightTheme)
    expect(container.querySelector('p')?.className).toMatch(/^app-box-root-/)
    expect(warn).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })
})
