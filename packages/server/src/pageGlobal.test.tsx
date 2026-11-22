import createCache from '@umber-style/cache'
import { CacheProvider, createStyle } from '@umber-style/react'
import { renderToString } from 'react-dom/server'
import createInstance from './createInstance'

const theme = { palette: { primary: '#1b5fd1' } }

/** The styling of an app, made once, and its pages: both render the base rules, the promo page a rule of its own. */
function createApp() {
  const { Global, ThemeProvider } = createStyle(theme)
  const cache = createCache({ key: 'pages' })
  const page = (isPromo: boolean) => (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <Global styles={{ body: { margin: 0 } }} />
        {isPromo ? <Global styles={{ nav: { outline: '3px solid' } }} /> : null}
        <p>page</p>
      </ThemeProvider>
    </CacheProvider>
  )
  return { cache, page }
}

/** Renders where there is no document, as a server does. */
function renderOnServer(node: ReturnType<ReturnType<typeof createApp>['page']>): string {
  vi.stubGlobal('document', undefined)
  try {
    return renderToString(node)
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('the global rules of pages that one cache serves', () => {
  it('are in the critical CSS of the page that rendered them only, in both orders', () => {
    const first = createApp()
    const promoFirst = renderOnServer(first.page(true))
    const homeAfter = renderOnServer(first.page(false))
    const { extractCritical } = createInstance(first.cache)
    expect(extractCritical(promoFirst).css).toContain('{nav{outline:3px solid;}}')
    expect(extractCritical(homeAfter).css).not.toContain('nav{')
    expect(extractCritical(homeAfter).css).toContain('{body{margin:0;}}')

    const second = createApp()
    const homeFirst = renderOnServer(second.page(false))
    const promoAfter = renderOnServer(second.page(true))
    const other = createInstance(second.cache)
    expect(other.extractCritical(homeFirst).css).toBe(extractCritical(homeAfter).css)
    expect(other.extractCritical(promoAfter).css).toBe(extractCritical(promoFirst).css)
  })

  it('are in the global chunk of their page, with their ids', () => {
    const { cache, page } = createApp()
    const promo = renderOnServer(page(true))
    const home = renderOnServer(page(false))
    const { extractCriticalToChunks } = createInstance(cache)
    const [promoGlobal] = extractCriticalToChunks(promo).styles
    const [homeGlobal] = extractCriticalToChunks(home).styles
    expect(promoGlobal.ids.filter((id) => id.startsWith('pages-global-'))).toHaveLength(2)
    expect(homeGlobal.ids.filter((id) => id.startsWith('pages-global-'))).toHaveLength(1)
  })
})
