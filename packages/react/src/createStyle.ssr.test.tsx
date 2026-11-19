// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { createStyle } from './createStyle'

const baseTheme = { palette: { primary: '#0000ff', text: '#111111' } }

describe('createStyle on the server', () => {
  it('renders nested themes with no DOM, and extracts their CSS', () => {
    expect(typeof document).toBe('undefined')
    const { styled, ThemeProvider, cache } = createStyle(baseTheme, { prefix: 'srv' })
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    const html = renderToStaticMarkup(
      <ThemeProvider theme={baseTheme}>
        <Button>a</Button>
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Button>b</Button>
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(html).toMatch(/<div class="srv-theme-\w+ srv-boundary srv-scope">/)
    expect(html).not.toContain('style=')
    const { css } = cache.extract()
    expect(css.match(/\.srv-theme-\w+\{/g)).toHaveLength(2)
    expect(css).toContain('.srv-scope{display:contents;}')
    expect(css).toContain('--srv-palette-primary:#ff0000;}')
    expect(css).toMatch(/\.srv-button-root-\w+\{color:var\(--srv-palette-primary\);\}/)
  })
})
