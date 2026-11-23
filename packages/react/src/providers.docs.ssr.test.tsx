// @vitest-environment node
// The examples of docs/themes.md, docs/server-rendering.md, docs/root-theme.md and
// docs/theme-conditions.md about the providers: the markup and the CSS that those pages show are the
// ones asserted here.
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { at, extractPageStyles } from '@umber-style/core'
import { createStyle } from './createStyle'

describe('the provider example of docs/themes.md', () => {
  it('renders no element for the outermost provider and a wrapper for each nested one', () => {
    const lightTheme = {
      palette: { primary: '#1b5fd1', text: '#1a1a1a', surface: '#ffffff' },
      space: [0, 4, 8, 16],
      breakpoints: ['600px', '900px'],
    }
    const { styled, ThemeProvider, useTheme, cache } = createStyle(lightTheme, {
      prefix: 'umber',
      hasServerStyleElements: false,
    })
    const Card = styled('div', { name: 'Card' })(({ theme }) => ({
      color: theme.palette.text,
      backgroundColor: theme.palette.surface,
      ...at(`@media (min-width: ${theme.breakpoints[0]})`, { padding: theme.space[3] }),
    }))
    function Swatch() {
      const theme = useTheme()
      return <code>{theme.palette.primary}</code>
    }
    const App = () => (
      <ThemeProvider theme={lightTheme}>
        <Card />
        <ThemeProvider theme={{ palette: { surface: '#fff4d6' } }}>
          <Card />
        </ThemeProvider>
        <ThemeProvider theme={{ breakpoints: ['480px'] }}>
          <Card />
        </ThemeProvider>
        <ThemeProvider theme={{ palette: { primary: '#0b7a4b' } }}>
          <Swatch />
        </ThemeProvider>
      </ThemeProvider>
    )
    const html = renderToStaticMarkup(<App />)
    expect(html).toBe(
      '<div class="umber-card-root-c45tr"></div>' +
        '<div class="umber-theme-1lpp26f umber-boundary umber-scope"><div class="umber-card-root-c45tr"></div></div>' +
        '<div class="umber-theme-0 umber-boundary umber-scope"><div class="umber-card-root-1h3unrm"></div></div>' +
        '<div class="umber-theme-45hmwp umber-boundary umber-scope"><code>#0b7a4b</code></div>'
    )
    const { css } = extractPageStyles(cache, html)
    expect(css).toContain(
      '@layer umber-theme{:where(:root){--umber-palette-text:#1a1a1a;--umber-palette-surface:#ffffff;--umber-space-3:16px;}}'
    )
    expect(css).toContain(
      '@layer umber-theme{.umber-theme-1lpp26f{--umber-palette-surface:#fff4d6;}}'
    )
    // A nested provider under the outermost one has one theme class: the outermost theme is on :root.
    expect(css.match(/\.umber-theme-\w+\{/g)).toEqual(['.umber-theme-1lpp26f{'])
    expect(css).toContain(
      '@layer umber-components{@media (min-width: 480px){.umber-card-root-1h3unrm{padding:var(--umber-space-3);}}}'
    )
  })
})

describe('the classic server render of docs/server-rendering.md', () => {
  it('declares the theme of the outermost provider on :root, in the one style element of the page', () => {
    const theme = { palette: { primary: '#1b5fd1', onPrimary: '#ffffff' }, space: [0, 4, 8, 16] }
    const { styled, ThemeProvider, cache } = createStyle(theme, {
      prefix: 'umber',
      hasServerStyleElements: false,
    })
    const Button = styled('button', { name: 'Button' })(({ theme: view }) => ({
      backgroundColor: view.palette.primary,
      color: view.palette.onPrimary,
      padding: view.space[2],
    }))
    const html = renderToString(
      <ThemeProvider theme={theme}>
        <Button>Save</Button>
      </ThemeProvider>
    )
    expect(html).toBe('<button class="umber-button-root-jiompv">Save</button>')
    expect(extractPageStyles(cache, html, { themes: [] }).tag).toBe(
      '<style data-style="umber" data-options="p=umber;x=;l=1;y=1;r=1;b=1;s=1;f=1;t=">' +
        '@layer umber-theme,umber-global,umber-components,umber-overrides;' +
        '@layer umber-theme{:where(:root){--umber-palette-primary:#1b5fd1;--umber-palette-on-primary:#ffffff;--umber-space-2:8px;}}' +
        '@layer umber-components{.umber-button-root-jiompv{background-color:var(--umber-palette-primary);color:var(--umber-palette-on-primary);padding:var(--umber-space-2);}}' +
        '</style>'
    )
  })
})

describe('the static page with several themes of docs/root-theme.md', () => {
  it('has the default provider on :root and the themes offered for <html> as classes', () => {
    const lightTheme = {
      palette: { primary: '#1b5fd1', text: '#1a1a1a', surface: '#ffffff' },
      space: [0, 4, 8, 16],
    }
    const darkTheme = {
      ...lightTheme,
      palette: { primary: '#8ab4ff', text: '#f2f2f2', surface: '#101114' },
    }
    const { styled, ThemeProvider, themeClass, cache } = createStyle(lightTheme, {
      prefix: 'umber',
      hasServerStyleElements: false,
    })
    const dark = themeClass(darkTheme, 'dark')
    const Page = styled('main', { name: 'Page' })(({ theme }) => ({
      backgroundColor: theme.palette.surface,
      color: theme.palette.text,
      padding: theme.space[3],
    }))
    const body = renderToStaticMarkup(
      <ThemeProvider theme={lightTheme} colorScheme="light">
        <Page>Hello</Page>
      </ThemeProvider>
    )
    expect(body).toBe('<main class="umber-page-root-1h3tp5s">Hello</main>')
    expect(extractPageStyles(cache, body, { themes: [dark] }).css).toBe(
      '@layer umber-theme,umber-global,umber-components,umber-overrides;' +
        '@layer umber-theme{:where(:root){--umber-palette-text:#1a1a1a;--umber-palette-surface:#ffffff;--umber-space-3:16px;color-scheme:light;}}' +
        '@layer umber-theme{.umber-theme-tk7v2e{--umber-palette-text:#f2f2f2;--umber-palette-surface:#101114;--umber-space-3:16px;color-scheme:dark;}}' +
        '@layer umber-components{.umber-page-root-1h3tp5s{background-color:var(--umber-palette-surface);color:var(--umber-palette-text);padding:var(--umber-space-3);}}'
    )
  })
})

describe('the conditions example of docs/theme-conditions.md', () => {
  it('has no marker for the outermost provider, and the markers on the wrapper of the nested one', () => {
    const lightTheme = {
      palette: { primary: '#1b5fd1', surface: '#ffffff' },
      space: [0, 4, 8, 16],
    }
    const darkTheme = { palette: { primary: '#8ab4ff', surface: '#101114' } }
    const { styled, ThemeProvider, when, whenScheme, cache } = createStyle(lightTheme, {
      prefix: 'umber',
      hasServerStyleElements: false,
    })
    const Card = styled('div', { name: 'Card' })({
      border: 'none',
      ...at(when(darkTheme, 'dark'), {
        border: '1px solid white',
        '&:hover': { borderColor: 'red' },
      }),
      ...at(whenScheme('dark'), { boxShadow: 'none' }),
    })
    const html = renderToStaticMarkup(
      <ThemeProvider theme={lightTheme} colorScheme="light">
        <Card />
        <ThemeProvider theme={darkTheme} colorScheme="dark">
          <Card />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(html).toBe(
      '<div class="umber-card-root-c8wvsy"></div>' +
        '<div class="umber-theme-8yk78z umber-boundary umber-scheme-dark umber-scope"><div class="umber-card-root-c8wvsy"></div></div>'
    )
    const { css } = extractPageStyles(cache, html)
    expect(css).toContain('@layer umber-theme{:where(:root){color-scheme:light;}}')
    expect(css).toContain(
      '@layer umber-components{@scope (.umber-theme-8yk78z) to (.umber-boundary){.umber-card-root-c8wvsy{border:1px solid white;}.umber-card-root-c8wvsy:hover{border-color:red;}}}'
    )
  })
})

describe('the example of docs/how-it-works.md', () => {
  it('has one component rule, the outer theme on :root and the nested one in its class', () => {
    const light = { palette: { primary: '#1b5fd1' } }
    const warm = { palette: { primary: '#c2410c' } }
    const { styled, ThemeProvider, cache } = createStyle(light, {
      prefix: 'umber',
      hasServerStyleElements: false,
    })
    const Tag = styled('span', { name: 'Tag' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    const html = renderToStaticMarkup(
      <ThemeProvider theme={light}>
        <Tag>one</Tag>
        <ThemeProvider theme={warm}>
          <Tag>two</Tag>
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(html).toBe(
      '<span class="umber-tag-root-n8ncc0">one</span>' +
        '<div class="umber-theme-1an5zox umber-boundary umber-scope"><span class="umber-tag-root-n8ncc0">two</span></div>'
    )
    const { css } = extractPageStyles(cache, html)
    expect(css).toContain('@layer umber-theme{:where(:root){--umber-palette-primary:#1b5fd1;}}')
    expect(css).toContain(
      '@layer umber-theme{.umber-theme-1an5zox{--umber-palette-primary:#c2410c;}}'
    )
  })
})
