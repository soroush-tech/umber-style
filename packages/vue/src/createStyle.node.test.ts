// @vitest-environment node
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createStyle } from './createStyle'

const baseTheme = { palette: { primary: '#0000ff', text: '#111111' } }

describe('createStyle on the server', () => {
  it('renders nested themes with no DOM, and extracts their CSS', async () => {
    expect(typeof document).toBe('undefined')
    const { styled, ThemeProvider, cache } = createStyle(baseTheme, { prefix: 'vs' })
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    const app = createSSRApp(() =>
      h(ThemeProvider, { theme: baseTheme }, () => [
        h(Button, null, () => 'a'),
        h(ThemeProvider, { theme: { palette: { primary: '#ff0000' } } }, () =>
          h(Button, null, () => 'b')
        ),
      ])
    )
    const html = await renderToString(app)
    // The outermost provider renders no element and declares its theme on :root; the nested one has
    // the class of what it changes, which is its merged theme below the outermost one.
    expect(html).toMatch(
      /^<!--\[--><button class="vs-button-root-\w+">a<\/button><div class="vs-theme-\w+ vs-boundary vs-scope">/
    )
    expect(html).not.toContain('style=')
    expect(html.match(/vs-button-root-\w+/g)).toHaveLength(2)
    const { css } = cache.extract()
    expect(css).toContain(':where(:root){--vs-palette-primary:#0000ff;}')
    expect(css.match(/\.vs-theme-\w+\{/g)).toHaveLength(1)
    expect(css).toContain('--vs-palette-primary:#ff0000;}')
    expect(css).toMatch(/\.vs-button-root-\w+\{color:var\(--vs-palette-primary\);\}/)
  })

  it('three deep, renders the class of the nested themes merged, without the outermost theme', async () => {
    const { styled, ThemeProvider, cache } = createStyle(baseTheme, { prefix: 'vd' })
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
      background: theme.palette.text,
    }))
    const app = createSSRApp(() =>
      h(ThemeProvider, { theme: baseTheme }, () =>
        h(ThemeProvider, { theme: { palette: { text: '#00ff00' } } }, () =>
          h(ThemeProvider, { theme: { palette: { primary: '#ff0000' } } }, () =>
            h(Button, null, () => 'b')
          )
        )
      )
    )
    const html = await renderToString(app)
    const [, own, full] =
      /<div class="vd-theme-\w+ vd-boundary vd-scope"><div class="(vd-theme-\w+) vd-boundary (vd-theme-\w+) vd-scope">/.exec(
        html
      ) ?? []
    const { css } = cache.extract()
    expect(css).toContain(`.${own}{--vd-palette-primary:#ff0000;}`)
    expect(css).toContain(`.${full}{--vd-palette-primary:#ff0000;--vd-palette-text:#00ff00;}`)
  })
})
