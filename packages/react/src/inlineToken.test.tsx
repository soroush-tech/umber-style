import { render, screen } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' }, zIndex: { modal: 100 } }

describe('an inline token in the client build', () => {
  it('follows the nearest provider: another value is another class, a variable stays one', () => {
    const sheet = createMemorySheet()
    const { styled, ThemeProvider } = createStyle(theme, {
      prefix: 'i',
      modes: { zIndex: 'inline' },
      cache: createCache({ hasLayers: false, prefix: 'i', sheet }),
    })
    const Box = styled('div')(({ theme: view }) => ({
      color: view.palette.primary,
      zIndex: view.zIndex.modal,
    }))
    render(
      <ThemeProvider theme={theme}>
        <Box data-testid="outer" />
        <ThemeProvider theme={{ zIndex: { modal: 300 }, palette: { primary: '#ff0000' } }}>
          <Box data-testid="nested" />
        </ThemeProvider>
      </ThemeProvider>
    )
    const outer = screen.getByTestId('outer').className
    const nested = screen.getByTestId('nested').className
    expect(nested).not.toBe(outer)
    expect(sheet.rules).toContain(`.${outer}{color:var(--i-palette-primary);z-index:100;}`)
    expect(sheet.rules).toContain(`.${nested}{color:var(--i-palette-primary);z-index:300;}`)
  })
})
