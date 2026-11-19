import { render, screen } from '@testing-library/react'
import { at, createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle'

const theme = {
  palette: { primary: '#0000ff' },
  space: [0, 4, 8],
  breakpoints: ['900px'],
}

describe('the client build makes the classes of the server build', () => {
  it('gives the Box of the server tests the same class name', () => {
    const engine = createEngine(theme, {
      prefix: 'f',
      cache: createCache({ prefix: 'f', sheet: createMemorySheet() }),
    })
    const { styled, ThemeProvider } = bindEngine(engine)
    const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({
      color: view.palette.primary,
      ...at(`@media (width >= ${view.breakpoints[0]})`, { padding: view.space[1] }),
    }))
    render(
      <ThemeProvider theme={theme}>
        <Box data-testid="box" />
      </ThemeProvider>
    )
    expect(screen.getByTestId('box').className).toBe('f-box-root-khapye')
  })
})
