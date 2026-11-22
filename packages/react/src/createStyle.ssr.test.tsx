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
    // The outermost provider renders no element and declares its theme on :root.
    expect(html).toMatch(/>a<\/button><div class="srv-theme-\w+ srv-boundary srv-scope">/)
    expect(html).not.toContain('style=')
    const { css } = cache.extract()
    expect(css).toContain(':where(:root){--srv-palette-primary:#0000ff;}')
    // The nested provider: the class of what it changes, which is its merged theme below the outermost one.
    expect(css.match(/\.srv-theme-\w+\{/g)).toHaveLength(1)
    expect(css).toContain('.srv-scope{display:contents;}')
    expect(css).toContain('--srv-palette-primary:#ff0000;}')
    expect(css).toMatch(/\.srv-button-root-\w+\{color:var\(--srv-palette-primary\);\}/)
  })

  it('three deep, sends the class of the nested themes merged, without the outermost theme', () => {
    const { styled, ThemeProvider, cache } = createStyle(baseTheme, { prefix: 'deep' })
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
      background: theme.palette.text,
    }))
    const html = renderToStaticMarkup(
      <ThemeProvider theme={baseTheme}>
        <ThemeProvider theme={{ palette: { text: '#00ff00' } }}>
          <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
            <Button>b</Button>
          </ThemeProvider>
        </ThemeProvider>
      </ThemeProvider>
    )
    const [, own, full] =
      /<div class="deep-theme-\w+ deep-boundary deep-scope"><div class="(deep-theme-\w+) deep-boundary (deep-theme-\w+) deep-scope">/.exec(
        html
      ) ?? []
    const { css } = cache.extract()
    expect(css).toContain(`.${own}{--deep-palette-primary:#ff0000;}`)
    expect(css).toContain(`.${full}{--deep-palette-primary:#ff0000;--deep-palette-text:#00ff00;}`)
  })
})
