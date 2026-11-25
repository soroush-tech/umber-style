// @vitest-environment node
import { Suspense, use, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// The Web Streams build: the Node entry of `react-dom/static` has `prerender` from React 19.2 only.
import { prerender } from 'react-dom/static.browser'
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

  it('renders the marker of its sets with hasServerStyleElements false, and extractPageStyles puts them in that page only', () => {
    const { Global, styled, keyframes, cache, engine } = createStyle(theme, {
      prefix: 'gx',
      hasServerStyleElements: false,
    })
    const spin = keyframes({ to: { rotate: '1turn' } }, { label: 'spin' })
    const Spinner = styled('i')({ animation: `${spin} 1s linear infinite` })
    const html = renderToStaticMarkup(
      <>
        <Global styles={[{ body: { margin: 0 } }, {}]} />
        <Spinner />
      </>
    )
    const [{ id }] = engine.resolveGlobal({ body: { margin: 0 } })
    expect(html).not.toContain('<style')
    expect(html).toMatch(new RegExp(`^<meta name="gx-global" content="${id}"/><i class="gx-\\w+">`))
    const { css } = extractPageStyles(cache, html)
    expect(css).toContain(`@keyframes ${spin}{100%{rotate:1turn;}}`)
    expect(css).toContain('@layer gx-global{body{margin:0;}}')
    expect(extractPageStyles(cache, '<p></p>').css).not.toContain('gx-global{')
  })

  it('renders no marker for styles with no rule', () => {
    const { Global } = createStyle(theme, { prefix: 'gn', hasServerStyleElements: false })
    expect(renderToStaticMarkup(<Global styles={{ body: {} }} />)).toBe('')
  })
})

describe('the global rules of pages rendered from one cache', () => {
  const promo = { nav: { outline: '3px solid' } }
  const base = { body: { margin: 0 } }

  /** Two pages of one app: both render the base styles, the promo page its own rule too. */
  function setup(hasServerStyleElements: boolean) {
    const style = createStyle(theme, { prefix: 'pg', hasServerStyleElements })
    const { Global, ThemeProvider } = style
    const Home = () => (
      <ThemeProvider theme={theme}>
        <Global styles={base} />
        <p>home</p>
      </ThemeProvider>
    )
    const Promo = () => (
      <ThemeProvider theme={theme}>
        <Global styles={base} />
        <Global styles={promo} />
        <p>promo</p>
      </ThemeProvider>
    )
    /** The CSS of a page: what extractPageStyles writes, and the style elements the markup carries. */
    const readPage = (html: string) =>
      html.replace(/<p>.*$/, '') + extractPageStyles(style.cache, html).css
    return { ...style, Home, Promo, readPage }
  }

  it.each([
    ['with style elements', true],
    ['with the marker', false],
  ])('holds the sets of that page only, in both orders (%s)', (_, hasServerStyleElements) => {
    const first = setup(hasServerStyleElements)
    const promoFirst = renderToStaticMarkup(<first.Promo />)
    const homeAfter = renderToStaticMarkup(<first.Home />)
    expect(first.readPage(promoFirst)).toContain('{nav{outline:3px solid;}}')
    expect(first.readPage(homeAfter)).not.toContain('nav{')
    expect(first.readPage(homeAfter)).toContain('{body{margin:0;}}')

    const second = setup(hasServerStyleElements)
    const homeFirst = renderToStaticMarkup(<second.Home />)
    const promoAfter = renderToStaticMarkup(<second.Promo />)
    expect(second.readPage(homeFirst)).toBe(first.readPage(homeAfter))
    expect(second.readPage(promoAfter)).toBe(first.readPage(promoFirst))
  })

  it('holds the sets of each page when the two renders are done before either is extracted', () => {
    const { Home, Promo, readPage } = setup(false)
    const home = renderToStaticMarkup(<Home />)
    const promoPage = renderToStaticMarkup(<Promo />)
    const homeAgain = renderToStaticMarkup(<Home />)
    expect(readPage(home)).not.toContain('nav{')
    expect(readPage(homeAgain)).toBe(readPage(home))
    expect(readPage(promoPage)).toContain('{nav{outline:3px solid;}}')
  })

  it('holds the sets of each page when two streamed renders interleave', async () => {
    const { Home, Promo, readPage } = setup(false)
    /** A promise that a test resolves, and a component that waits for it before its children render. */
    const createGate = () => {
      let open = () => undefined as void
      const promise = new Promise<void>((resolve) => {
        open = resolve
      })
      return { open, promise }
    }
    const Wait = ({
      gate,
      children,
    }: {
      gate: { promise: Promise<void> }
      children: ReactNode
    }) => {
      use(gate.promise)
      return children
    }
    const homeGate = createGate()
    const promoGate = createGate()
    const read = async (gate: { promise: Promise<void> }, page: ReactNode) => {
      const { prelude } = await prerender(
        <Suspense fallback={null}>
          <Wait gate={gate}>{page}</Wait>
        </Suspense>
      )
      return new Response(prelude).text()
    }
    const homeHtml = read(homeGate, <Home />)
    const promoHtml = read(promoGate, <Promo />)
    promoGate.open()
    await new Promise((resolve) => setTimeout(resolve, 0))
    homeGate.open()
    const [home, promoPage] = await Promise.all([homeHtml, promoHtml])
    expect(readPage(home)).not.toContain('nav{')
    expect(readPage(home)).toContain('{body{margin:0;}}')
    expect(readPage(promoPage)).toContain('{nav{outline:3px solid;}}')
  })

  it('names the set of the theme a Global reads: a provider with another raw value makes another set', () => {
    const { Global, ThemeProvider, cache, globalStyles } = setup(false)
    const wide = globalStyles((view) => ({
      [`@media (min-width: ${view.breakpoints.md}px)`]: { body: { margin: 0 } },
    }))
    const page = (md: number) =>
      renderToStaticMarkup(
        <ThemeProvider theme={{ breakpoints: { md } }}>
          <Global styles={wide} />
        </ThemeProvider>
      )
    const narrow = page(768)
    const large = page(1024)
    expect(extractPageStyles(cache, narrow).css).toContain('(min-width: 768px)')
    expect(extractPageStyles(cache, narrow).css).not.toContain('(min-width: 1024px)')
    expect(extractPageStyles(cache, large).css).toContain('(min-width: 1024px)')
    expect(extractPageStyles(cache, large).css).not.toContain('(min-width: 768px)')
  })

  it('holds the sets that the engine inserted for the app in every page', () => {
    const { Home, engine, readPage } = setup(false)
    engine.insertGlobal({ html: { color: 'red' } })
    expect(readPage(renderToStaticMarkup(<Home />))).toContain('{html{color:red;}}')
    expect(extractPageStyles(engine.cache, '<p></p>').css).toContain('{html{color:red;}}')
  })
})
