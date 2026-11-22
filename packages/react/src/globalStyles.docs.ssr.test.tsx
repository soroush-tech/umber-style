// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from './createStyle'

// The examples of "On a server" in docs/animations-and-global-styles.md.
const theme = {
  palette: { background: '#ffffff', text: '#1a1a1a' },
  breakpoints: ['600px', '900px'],
}

function createApp(hasServerStyleElements: boolean) {
  const { styled, keyframes, Global, ThemeProvider, globalStyles, cache, engine } = createStyle(
    theme,
    { prefix: 'umber', hasServerStyleElements }
  )
  const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }, { label: 'fade' })
  const base = globalStyles((view) => ({ body: { margin: 0, color: view.palette.text } }))
  const Toast = styled('div', { name: 'Toast' })({ animation: `${fade} 200ms ease-out` })
  const App = () => (
    <ThemeProvider theme={theme}>
      <Global styles={base} />
      <Toast>Saved</Toast>
    </ThemeProvider>
  )
  return { App, cache, engine, keyframes }
}

describe('the examples of the server section of the global styles page', () => {
  it('sends the marker of the set without style elements, and the whole page in one element', () => {
    const { App, cache } = createApp(false)
    const html = renderToString(<App />)
    expect(html).toMatch(/^<meta name="umber-global" content="umber-global-a3061a"\/>/)
    expect(extractPageStyles(cache, html).css).toBe(
      '@layer umber-theme,umber-global,umber-components,umber-overrides;' +
        '@keyframes fade-1acbpvw{0%{opacity:0;}100%{opacity:1;}}' +
        '@layer umber-theme{:where(:root){--umber-palette-text:#1a1a1a;}}' +
        '@layer umber-global{body{margin:0;color:var(--umber-palette-text);}}' +
        '@layer umber-components{.umber-toast-root-1atv36o{animation:fade-1acbpvw 200ms ease-out;}}'
    )
  })

  it.each([true, false])(
    'leaves the global rule of a Global out of a page that did not render it (style elements: %s)',
    (hasServerStyleElements) => {
      const { App, cache, engine, keyframes } = createApp(hasServerStyleElements)
      renderToString(<App />)
      const spin = keyframes({ to: { rotate: '1turn' } }, { label: 'spin' })
      const { css } = extractPageStyles(cache, '<p>An empty page</p>', { animations: [spin] })
      expect(css).toBe('@keyframes spin-1jqe2jv{100%{rotate:1turn;}}')
      // A set written for the app, with no component, is in every page.
      engine.insertGlobal({ html: { margin: 0 } })
      expect(extractPageStyles(cache, '<p>An empty page</p>').css).toBe(
        '@layer umber-theme,umber-global,umber-components,umber-overrides;' +
          '@layer umber-global{html{margin:0;}}'
      )
    }
  )
})
