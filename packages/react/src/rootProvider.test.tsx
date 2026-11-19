import { render } from '@testing-library/react'
import { createCache, createLazyEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4] }

describe('a ThemeProvider with isRoot', () => {
  it('renders no element and no class, but gives the theme and makes its rule', () => {
    const sheet = createMemorySheet()
    const { ThemeProvider, useTheme, engine } = createStyle(theme, {
      prefix: 'r',
      cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'r', sheet }),
    })
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return <i data-testid="probe" />
    }
    const { container } = render(
      <ThemeProvider theme={theme} isRoot>
        <Probe />
        <ThemeProvider theme={{ space: [0, 8] }}>
          <b />
        </ThemeProvider>
      </ThemeProvider>
    )
    const [first, second] = [...container.children]
    expect(first.tagName).toBe('I')
    expect(container.querySelector('[class]')?.tagName).toBe('DIV')
    expect(second.tagName).toBe('DIV')
    expect(second.className).toMatch(/^r-theme-/)
    expect(seen[0]).toEqual(theme)
    const rootClass = engine.themeId(theme)
    expect(sheet.rules).toContain(
      `.${rootClass}{--r-palette-primary:#0000ff;--r-space-0:0;--r-space-1:4px;}`
    )
    expect(container.querySelectorAll('[class]')).toHaveLength(1)
  })
})

describe('a ThemeProvider with isRoot and a color scheme of its own', () => {
  function setupRoot() {
    const sheet = createMemorySheet()
    const style = createStyle(theme, {
      prefix: 'r',
      cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'r', sheet }),
    })
    return { ...style, sheet }
  }

  it('makes no theme rule and no class: the app made the one it uses with themeClass', () => {
    const { ThemeProvider, themeClass, sheet } = setupRoot()
    const htmlClass = themeClass(theme, 'light')
    const before = [...sheet.rules]
    expect(before).toHaveLength(1)
    const { container } = render(
      <ThemeProvider theme={theme} colorScheme="dark" isRoot>
        <i />
      </ThemeProvider>
    )
    expect(sheet.rules).toEqual(before)
    expect(container.innerHTML).toBe('<i></i>')
    expect(htmlClass).toContain('r-scheme-light')
  })

  it('makes no rule at all when the app made none', () => {
    const { ThemeProvider, sheet } = setupRoot()
    render(
      <ThemeProvider theme={theme} isRoot>
        <i />
      </ThemeProvider>
    )
    expect(sheet.rules).toEqual([])
  })

  it('still gives the engine its base theme, when the engine had none', () => {
    const sheet = createMemorySheet()
    const engine = createLazyEngine<typeof theme>({
      prefix: 'r',
      cache: createCache({ hasLayers: false, prefix: 'r', sheet }),
    })
    const { ThemeProvider, useTheme } = bindEngine(engine)
    let seen: unknown
    const Probe = () => {
      seen = useTheme()
      return null
    }
    expect(engine.hasTheme).toBe(false)
    render(
      <ThemeProvider theme={theme} isRoot>
        <Probe />
      </ThemeProvider>
    )
    expect(engine.baseTheme).toBe(theme)
    expect(seen).toEqual(theme)
    expect(sheet.rules).toEqual([])
  })
})
