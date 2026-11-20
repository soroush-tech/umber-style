// @vitest-environment node
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { text: '#111111' }, breakpoints: { md: 768 } }

describe('Global in a server render', () => {
  it('renders nothing, and leaves its rules and their animations for extractPageStyles', async () => {
    expect(typeof document).toBe('undefined')
    const { Global, ThemeProvider, styled, keyframes, globalStyles, cache } = createStyle(theme, {
      prefix: 'vg',
    })
    const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const spin = keyframes({ to: { rotate: '1turn' } }, { label: 'spin' })
    const base = globalStyles((view) => ({
      [`@media (min-width: ${view.breakpoints.md}px)`]: {
        body: { color: view.palette.text, animation: `${fade} 1s` },
      },
    }))
    const Spinner = styled('i', { name: 'Spinner' })({ animation: `${spin} 1s linear infinite` })
    const app = createSSRApp(() =>
      h(ThemeProvider, { theme: { breakpoints: { md: 1024 } }, isRoot: true }, () => [
        h(Global, { styles: base }),
        h(Spinner),
      ])
    )
    const html = await renderToString(app)
    expect(html).not.toContain('<style')
    expect(html).not.toContain('style=')
    const { css } = extractPageStyles(cache, html)
    expect(css).toContain(`@keyframes ${fade}{0%{opacity:0;}}`)
    expect(css).toContain(`@keyframes ${spin}{100%{rotate:1turn;}}`)
    expect(css).toContain(
      `@layer vg-global{@media (min-width: 1024px){body{color:var(--vg-palette-text);animation:${fade} 1s;}}}`
    )
    // A server unmounts nothing: the global rules are in every page the cache renders.
    expect(extractPageStyles(cache, '<p></p>').css).toContain('@media (min-width: 1024px)')
    expect(extractPageStyles(cache, '<p></p>').css).not.toContain(spin)
  })
})
