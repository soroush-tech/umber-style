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
    expect(html).toMatch(/^<div class="vs-theme-\w+ vs-scope">/)
    expect(html).not.toContain('style=')
    expect(html.match(/vs-button-root-\w+/g)).toHaveLength(2)
    const { css } = cache.extract()
    expect(css.match(/\.vs-theme-\w+\{/g)).toHaveLength(2)
    expect(css).toContain('--vs-palette-primary:#ff0000;}')
    expect(css).toMatch(/\.vs-button-root-\w+\{color:var\(--vs-palette-primary\);\}/)
  })
})
