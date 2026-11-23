// @vitest-environment node
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const theme = { palette: { primary: '#0000ff', text: '#111111' } }

describe('the client build rendered on a server', () => {
  it('renders the style elements of the classes of a styled element', () => {
    expect(typeof document).toBe('undefined')
    const { styled } = createStyle(theme, { prefix: 'se' })
    const Box = styled('div', { name: 'Box' })({ margin: 1 })
    const Dyn = styled('div', { name: 'Dyn' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    const html = renderToStaticMarkup(
      <>
        <Box />
        <Dyn />
      </>
    )
    expect(html).toMatch(/<style data-precedence="se" data-href="[^"]*se-box-root-\w+[^"]*"/)
    expect(html).toContain('@layer se-theme,se-global,se-components,se-overrides;')
    expect(html).toContain('color:var(--se-palette-primary);')
    expect(html).toMatch(/<div class="se-box-root-\w+"><\/div>/)
  })

  it('sends the root theme and one stamp for the outermost provider, which renders no element', () => {
    const { styled, ThemeProvider, cache } = createStyle(theme, { prefix: 'se' })
    const Box = styled('div')({ margin: 1 })
    const html = renderToStaticMarkup(
      <ThemeProvider theme={theme} colorScheme="light">
        <Box />
      </ThemeProvider>
    )
    expect(html).toContain(`<meta name="se-options" content="${cache.fingerprint}"/>`)
    expect(html).toMatch(/data-href="se-root-\w+/)
    expect(html).toContain(
      ':where(:root){--se-palette-primary:#0000ff;--se-palette-text:#111111;color-scheme:light;}'
    )
    expect(html).not.toMatch(/<div class="se-theme/)
    expect(html).toMatch(/<div class="se-\w+"><\/div>$/)
  })

  it('sends the theme classes and the scope class of a nested provider, and its wrapper', () => {
    const { styled, ThemeProvider } = createStyle(theme, { prefix: 'se' })
    const Box = styled('div')({ margin: 1 })
    const html = renderToStaticMarkup(
      <ThemeProvider theme={theme}>
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }} colorScheme="light">
          <Box />
        </ThemeProvider>
      </ThemeProvider>
    )
    // React merges the style elements of one precedence into one, with every href.
    expect(html).toMatch(/data-href="[^"]*se-theme-\w+[^"]*"/)
    expect(html).toContain('.se-scope{display:contents;}')
    expect(html).toMatch(/<div class="se-theme-\w+ se-boundary se-scheme-light se-scope">/)
  })

  it('sends the theme classes that the app made for a root provider, and renders no element', () => {
    const { ThemeProvider, themeClass } = createStyle(theme, { prefix: 'se' })
    themeClass(theme, 'light')
    const html = renderToStaticMarkup(
      <ThemeProvider theme={theme} isRoot>
        <i />
      </ThemeProvider>
    )
    expect(html).toContain('<meta name="se-options"')
    expect(html).toMatch(/data-href="se-theme-\w+"/)
    expect(html.endsWith('<i></i>')).toBe(true)
  })

  it('renders none of it with hasServerStyleElements false', () => {
    const { styled, ThemeProvider, themeClass } = createStyle(theme, {
      prefix: 'se',
      hasServerStyleElements: false,
    })
    themeClass(theme)
    const Box = styled('div')({ margin: 1 })
    const html = renderToStaticMarkup(
      <ThemeProvider theme={theme} isRoot>
        <ThemeProvider theme={theme}>
          <Box />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(html).not.toContain('<style')
    expect(html).not.toContain('<meta')
  })

  it('takes the option from configure on the default style', () => {
    const defaults = createDefaultStyle()
    defaults.configure({ prefix: 'df', hasServerStyleElements: false })
    const Box = defaults.styled('div')({ margin: 1 })
    expect(renderToString(<Box />)).not.toContain('<style')
  })
})
