// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { createDefaultStyle } from './defaultStyle'

const light = { palette: { primary: '#0000ff' } }

describe('the default style on the server', () => {
  it('sets the base theme when the outermost provider renders, before its children', () => {
    expect(typeof document).toBe('undefined')
    const { styled, ThemeProvider, getEngine, configure } = createDefaultStyle()
    configure({ prefix: 'ds' })
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    const html = renderToStaticMarkup(
      <ThemeProvider theme={light}>
        <Button>a</Button>
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Button>b</Button>
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(html.match(/class="ds-button-root-\w+"/g)).toHaveLength(2)
    const { css } = getEngine().cache.extract()
    // The outer theme is on :root; the nested one changes the one token there is, so its own class is
    // the class of its whole merged theme.
    expect(css).toContain(':where(:root){--ds-palette-primary:#0000ff;}')
    expect(css.match(/\.ds-theme-\w+\{/g)).toHaveLength(1)
    expect(css).toMatch(/\.ds-button-root-\w+\{color:var\(--ds-palette-primary\);\}/)
  })
})
