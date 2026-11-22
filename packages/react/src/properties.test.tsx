import { render } from '@testing-library/react'
import {
  alpha,
  createCache,
  createEngine,
  createMemorySheet,
  createStyleTag,
} from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

const PRIMARY =
  '@property --h-palette-primary{syntax:"<color>";inherits:true;initial-value:#0000ff;}'

afterEach(() => {
  document.head.innerHTML = ''
})

describe('the options of the engine in the client build', () => {
  it('takes hasColorFallbacks and registered through createStyle', () => {
    const sheet = createMemorySheet()
    const { styled, ThemeProvider } = createStyle(theme, {
      prefix: 'o',
      registered: { palette: true },
      cache: createCache({ prefix: 'o', hasLayers: false, hasColorFallbacks: false, sheet }),
    })
    const Box = styled('div')(({ theme: view }) => ({
      background: alpha(view.palette.primary, 0.5),
    }))
    render(
      <ThemeProvider theme={theme}>
        <Box />
      </ThemeProvider>
    )
    const css = sheet.rules.join('')
    expect(css).toContain(
      'background:color-mix(in srgb, var(--o-palette-primary) 50%, transparent);}'
    )
    expect(css).toContain('@property --o-palette-primary{syntax:"<color>";inherits:true;')
  })

  it('has the engine make a cache with the fallbacks, by default', () => {
    const { engine } = createStyle(theme, { prefix: 'o' })
    const className = engine.css({ color: alpha('#fff', 0.5) })
    expect(engine.cache.getRules(className)[0]).toContain(
      'color:rgba(255, 255, 255, 0.5);color:color-mix('
    )
  })
})

describe('registered properties and a classic server render', () => {
  it.each([true, false])(
    'are in the style element, and the client inserts none of them again, speedy %s',
    (speedy) => {
      const make = (cache?: ReturnType<typeof createCache>) =>
        bindEngine(
          createEngine(theme, {
            prefix: 'h',
            registered: { 'palette.primary': true },
            speedy,
            ...(cache ? { cache } : {}),
          })
        )
      // The cache that an engine is given does not know the token options of that engine: it is given the
      // signature that the engine makes for its own cache, so that the stamp of the server is the same.
      const signature = make().cache.fingerprint.split(';').at(-1)?.slice(2)
      document.head.innerHTML = ''
      const server = make(
        createCache({ prefix: 'h', tokenSignature: signature, sheet: createMemorySheet() })
      )
      const Box = server.styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
      const { container } = render(
        <server.ThemeProvider theme={theme}>
          <Box />
        </server.ThemeProvider>
      )
      const tag = createStyleTag(server.cache)
      expect(tag).toContain(PRIMARY)
      container.remove()

      document.head.innerHTML = tag
      const readCount = () =>
        [...document.querySelectorAll<HTMLStyleElement>('style[data-style="h"]')].flatMap(
          (element) => [...(element.sheet?.cssRules ?? [])]
        ).length
      const before = readCount()
      const client = make()
      const Again = client.styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
      render(
        <client.ThemeProvider theme={theme}>
          <Again />
        </client.ThemeProvider>
      )
      expect(before).toBeGreaterThan(2)
      expect(readCount()).toBe(before)
    }
  )
})
