import { render } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

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
