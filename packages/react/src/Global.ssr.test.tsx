// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { text: '#111111' }, breakpoints: { md: 768 } }

describe('Global in the client build, rendered on a server', () => {
  it('renders a style element for each set, its id as href, after those of the animations it uses', () => {
    expect(typeof document).toBe('undefined')
    const { Global, ThemeProvider, keyframes, globalStyles, engine } = createStyle(theme, {
      prefix: 'gs',
    })
    const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const base = globalStyles((view) => ({
      body: { color: view.palette.text, animation: `${fade} 1s` },
      [`@media (min-width: ${view.breakpoints.md}px)`]: { body: { margin: 0 } },
    }))
    const html = renderToStaticMarkup(
      <ThemeProvider theme={{ breakpoints: { md: 1024 } }} isRoot>
        <Global styles={[base, base, {}, { html: { margin: 0 } }]} />
        <Global styles={{ body: { animation: `${fade} 2s` } }} />
      </ThemeProvider>
    )
    const view = engine.createThemeView({ ...theme, breakpoints: { md: 1024 } })
    const [first, second, third] = engine
      .resolveGlobal([base, { html: { margin: 0 } }, { body: { animation: `${fade} 2s` } }], view)
      .map(({ id }) => id)
    expect(html).toContain(
      `<style data-precedence="gs" data-href="${fade} ${first} ${second} ${third}">` +
        `@keyframes ${fade}{0%{opacity:0;}}` +
        `@layer gs-theme,gs-global,gs-components,gs-overrides;` +
        `@layer gs-global{body{color:var(--gs-palette-text);animation:${fade} 1s;}}` +
        `@layer gs-global{@media (min-width: 1024px){body{margin:0;}}}`
    )
    expect(html).toContain(`@layer gs-global{html{margin:0;}}`)
    expect(html.match(/@keyframes/g)).toHaveLength(1)
  })

  it('renders the animations of a styled class as style elements of their own, each once', () => {
    const { styled, keyframes } = createStyle(theme, { prefix: 'ga' })
    const pulse = keyframes({ '50%': { opacity: 0.4 } }, { label: 'pulse' })
    const Skeleton = styled('div', { name: 'Skeleton' })<{ isSlow?: boolean }>(
      { animation: `${pulse} 1.5s ease-in-out infinite` },
      ({ isSlow }) => ({ animationName: pulse, animationDuration: isSlow ? 3000 : 1500 })
    )
    const Bar = styled('i', { name: 'Bar' })({ animation: `${pulse} 1s` })
    const html = renderToStaticMarkup(
      <>
        <Skeleton isSlow />
        <Bar />
      </>
    )
    expect(html.match(/@keyframes/g)).toHaveLength(1)
    expect(html).toMatch(new RegExp(`data-href="${pulse} ga-skeleton-root-\\w+ ga-skeleton-root-`))
    expect(html).toContain(`@keyframes ${pulse}{50%{opacity:0.4;}}`)
  })

  it('renders nothing with hasServerStyleElements false, and leaves the rules for extractPageStyles', () => {
    const { Global, styled, keyframes, cache } = createStyle(theme, {
      prefix: 'gx',
      hasServerStyleElements: false,
    })
    const spin = keyframes({ to: { rotate: '1turn' } }, { label: 'spin' })
    const Spinner = styled('i')({ animation: `${spin} 1s linear infinite` })
    const html = renderToStaticMarkup(
      <>
        <Global styles={{ body: { margin: 0 } }} />
        <Spinner />
      </>
    )
    expect(html).not.toContain('<style')
    const { css } = extractPageStyles(cache, html)
    expect(css).toContain(`@keyframes ${spin}{100%{rotate:1turn;}}`)
    expect(css).toContain('@layer gx-global{body{margin:0;}}')
    expect(extractPageStyles(cache, '<p></p>').css).toContain('@layer gx-global{body{margin:0;}}')
  })
})
