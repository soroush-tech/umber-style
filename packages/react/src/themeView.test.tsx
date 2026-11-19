import { render, screen } from '@testing-library/react'
import { createCache, createMemorySheet, NO_THEME_MESSAGE } from '@umber-style/core'
import { space } from '@soroush.tech/styled-system/space'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const theme = {
  palette: { primary: '#0000ff' },
  space: [0, 4, 8],
  breakpoints: ['900px'],
}

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, { prefix: 'b', cache: createCache({ prefix: 'b', sheet }) })
  const rulesOf = (className: string) =>
    sheet.rules.filter((rule) => rule.includes(`.${className}`))
  return { ...style, sheet, rulesOf }
}

describe('function styles read the real theme of the nearest provider', () => {
  it('puts the breakpoint of each provider in its own media rule, with its own class', () => {
    const { styled, ThemeProvider, rulesOf } = setup()
    const Box = styled('div')(({ theme: view }) => ({
      color: view.palette.primary,
      [`@media (width >= ${view.breakpoints[0]})`]: { padding: view.space[1] },
    }))
    render(
      <ThemeProvider theme={theme}>
        <Box data-testid="outer" />
        <ThemeProvider theme={{ breakpoints: ['500px'] }}>
          <Box data-testid="nested" />
        </ThemeProvider>
      </ThemeProvider>
    )
    const outer = screen.getByTestId('outer').className
    const nested = screen.getByTestId('nested').className
    expect(nested).not.toBe(outer)
    expect(rulesOf(outer)).toEqual([
      `.${outer}{color:var(--b-palette-primary);}`,
      `@media (width >= 900px){.${outer}{padding:var(--b-space-1);}}`,
    ])
    expect(rulesOf(nested)).toEqual([
      `.${nested}{color:var(--b-palette-primary);}`,
      `@media (width >= 500px){.${nested}{padding:var(--b-space-1);}}`,
    ])
  })

  it('gives the same class under two providers that differ only in token values', () => {
    const { styled, ThemeProvider } = setup()
    const Box = styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
    render(
      <ThemeProvider theme={theme}>
        <Box data-testid="outer" />
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Box data-testid="nested" />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(screen.getByTestId('nested').className).toBe(screen.getByTestId('outer').className)
  })

  it('gives a responsive styled-system prop the media rule of the nearest provider', () => {
    const { styled, ThemeProvider, sheet } = setup()
    const Box = styled('div')(space)
    render(
      <ThemeProvider theme={theme}>
        <Box p={[1, 2]} />
        <ThemeProvider theme={{ breakpoints: ['500px'] }}>
          <Box p={[1, 2]} />
        </ThemeProvider>
      </ThemeProvider>
    )
    const media = sheet.rules.filter((rule) => rule.startsWith('@media'))
    expect(media).toHaveLength(2)
    expect(media[0]).toContain('@media (width >= 900px){')
    expect(media[1]).toContain('@media (width >= 500px){')
    expect(media[0]).toContain('padding:var(--b-space-2);')
  })

  it('reads the theme of useStyle sheets from the nearest provider too', () => {
    const { StyleSheet, useStyle, ThemeProvider, rulesOf } = setup()
    const sheet = StyleSheet.create((view) => ({
      box: { [`@media (width >= ${view.breakpoints[0]})`]: { margin: 1 } },
    }))
    const seen: string[] = []
    const Probe = () => {
      seen.push(useStyle(sheet).box.className)
      return null
    }
    render(
      <ThemeProvider theme={theme}>
        <Probe />
        <ThemeProvider theme={{ breakpoints: ['500px'] }}>
          <Probe />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(seen[0]).not.toBe(seen[1])
    expect(rulesOf(seen[1])[0]).toContain('@media (width >= 500px)')
  })
})

describe('what reads no context', () => {
  it('renders a component with object styles, and a sheet of objects, with no theme at all', () => {
    const { styled, StyleSheet, useStyle } = createDefaultStyle()
    const Box = styled('div')({ color: 'red' })
    const sheet = StyleSheet.create({ box: { margin: 1 } })
    const Probe = () => <Box data-testid="box" className={useStyle(sheet).box.className} />
    render(<Probe />)
    expect(screen.getByTestId('box').className).toMatch(/^css-/)
  })

  it('throws for a function style with no theme', () => {
    const { styled } = createDefaultStyle()
    const Box = styled('div')(({ theme: view }) => ({ color: view.palette }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Box />)).toThrow(NO_THEME_MESSAGE)
  })
})
