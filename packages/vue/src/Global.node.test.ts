// @vitest-environment node
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { text: '#111111' }, breakpoints: { md: 768 } }

describe('Global in a server render', () => {
  it('renders the marker of its sets, a comment, and leaves its rules and their animations for extractPageStyles', async () => {
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
    expect(html).toMatch(/^<!--\[--><!--vg-global vg-global-\w+--><i class="vg-spinner-root-\w+">/)
    const { css } = extractPageStyles(cache, html)
    expect(css).toContain(`@keyframes ${fade}{0%{opacity:0;}}`)
    expect(css).toContain(`@keyframes ${spin}{100%{rotate:1turn;}}`)
    expect(css).toContain(
      `@layer vg-global{@media (min-width: 1024px){body{color:var(--vg-palette-text);animation:${fade} 1s;}}}`
    )
    // The rules stay in the cache, and are in the pages that render them only.
    expect(extractPageStyles(cache, '<p></p>').css).not.toContain('@media (min-width: 1024px)')
    expect(extractPageStyles(cache, '<p></p>').css).not.toContain(spin)
  })

  it('renders an empty comment for styles with no rule', async () => {
    const { Global } = createStyle(theme, { prefix: 've' })
    expect(await renderToString(createSSRApp(() => h(Global, { styles: {} })))).toBe('<!---->')
  })
})

describe('the Vue example of docs/animations-and-global-styles.md', () => {
  it('renders the marker of its set, and the page has its rules', async () => {
    const docsTheme = { palette: { text: '#1a1a1a' } }
    const { Global, styled, keyframes, cache } = createStyle(docsTheme, { prefix: 'umber' })
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }, { label: 'fade' })
    const Toast = styled('div', { name: 'Toast' })({ animation: `${fade} 200ms ease-out` })
    const app = createSSRApp({
      render: () => [
        h(Global, {
          styles: (view: typeof docsTheme) => ({ body: { color: view.palette.text } }),
        }),
        h(Toast, null, () => 'Saved'),
      ],
    })
    const html = await renderToString(app)
    expect(html).toContain('<!--umber-global umber-global-1k672ui-->')
    expect(extractPageStyles(cache, html).css).toBe(
      '@layer umber-theme,umber-global,umber-components,umber-overrides;' +
        '@keyframes fade-1acbpvw{0%{opacity:0;}100%{opacity:1;}}' +
        '@layer umber-global{body{color:var(--umber-palette-text);}}' +
        '@layer umber-components{.umber-toast-root-1atv36o{animation:fade-1acbpvw 200ms ease-out;}}'
    )
  })
})

describe('the global rules of pages rendered from one cache', () => {
  /** Two pages of one app: both render the base styles, the promo page its own rule too. */
  function setup() {
    const style = createStyle(theme, { prefix: 'vp' })
    const { Global, ThemeProvider } = style
    const base = { body: { margin: 0 } }
    const promo = { nav: { outline: '3px solid' } }
    const page = (isPromo: boolean) =>
      renderToString(
        createSSRApp(() =>
          h(ThemeProvider, { theme }, () => [
            h(Global, { styles: base }),
            isPromo ? h(Global, { styles: promo }) : null,
            h('p', null, 'page'),
          ])
        )
      )
    const readPage = (html: string) => extractPageStyles(style.cache, html).css
    return { ...style, page, readPage }
  }

  it('holds the sets of that page only, in both orders', async () => {
    const first = setup()
    const promoFirst = await first.page(true)
    const homeAfter = await first.page(false)
    expect(first.readPage(promoFirst)).toContain('{nav{outline:3px solid;}}')
    expect(first.readPage(homeAfter)).not.toContain('nav{')
    expect(first.readPage(homeAfter)).toContain('{body{margin:0;}}')

    const second = setup()
    const homeFirst = await second.page(false)
    const promoAfter = await second.page(true)
    expect(second.readPage(homeFirst)).toBe(first.readPage(homeAfter))
    expect(second.readPage(promoAfter)).toBe(first.readPage(promoFirst))
  })

  it('holds the sets of each page when the renders run at the same time', async () => {
    const { page, readPage } = setup()
    const [home, promoPage, homeAgain] = await Promise.all([page(false), page(true), page(false)])
    expect(readPage(home)).not.toContain('nav{')
    expect(readPage(homeAgain)).toBe(readPage(home))
    expect(readPage(promoPage)).toContain('{nav{outline:3px solid;}}')
  })

  it('names the set of the theme a Global reads: a provider with another raw value makes another set', async () => {
    const { Global, ThemeProvider, cache, globalStyles } = setup()
    const wide = globalStyles((view) => ({
      [`@media (min-width: ${view.breakpoints.md}px)`]: { body: { margin: 0 } },
    }))
    const page = (md: number) =>
      renderToString(
        createSSRApp(() =>
          h(ThemeProvider, { theme: { breakpoints: { md } } }, () => h(Global, { styles: wide }))
        )
      )
    const [narrow, large] = await Promise.all([page(768), page(1024)])
    expect(extractPageStyles(cache, narrow).css).toContain('(min-width: 768px)')
    expect(extractPageStyles(cache, narrow).css).not.toContain('(min-width: 1024px)')
    expect(extractPageStyles(cache, large).css).toContain('(min-width: 1024px)')
    expect(extractPageStyles(cache, large).css).not.toContain('(min-width: 768px)')
  })

  it('holds the sets that the engine inserted for the app in every page', async () => {
    const { page, readPage, engine } = setup()
    engine.insertGlobal({ html: { color: 'red' } })
    expect(readPage(await page(false))).toContain('{html{color:red;}}')
  })
})
