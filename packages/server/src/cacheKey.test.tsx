import createCache from '@umber-style/cache'
import {
  CacheProvider,
  configure,
  getEngine,
  styled,
  ThemeProvider,
  type Theme,
} from '@umber-style/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import createInstance from './createInstance'

// The question of an app team: the library configures the default style with one prefix, and the
// app's registry makes its cache with another key. What changes?
const theme = { palette: { primary: '#1b5fd1', accent: '#d11b5f' }, space: [0, 4, 8] }
type AppTheme = typeof theme
const readTheme = (view: Theme) => view as unknown as AppTheme

// The default style is typed with the `Theme` an app declares; this file gives its own shape.
configure({ prefix: 'soroush', theme: theme as unknown as Theme, hasValueRepair: true })

const Box = styled('p', { name: 'Box' })(({ theme: view }) => ({
  color: readTheme(view).palette.primary,
  padding: readTheme(view).space[2],
}))

/** Renders where there is no document, as a server does. */
function renderOnServer(node: ReactNode): string {
  vi.stubGlobal('document', undefined)
  try {
    return renderToString(node)
  } finally {
    vi.unstubAllGlobals()
  }
}

/** A page under a cache with the key `other`, and the CSS that the server instance gives for it. */
function renderUnderOther() {
  const other = createCache({ key: 'other' })
  const html = renderOnServer(
    <CacheProvider value={other}>
      <ThemeProvider theme={theme}>
        <Box>under the cache</Box>
      </ThemeProvider>
    </CacheProvider>
  )
  const { extractCritical } = createInstance(other)
  return { html, css: extractCritical(html).css }
}

describe('a cache key that is not the prefix the default style was configured with', () => {
  it('names the classes and the variables with the key of the cache, and declares them on :root of that cache', () => {
    const { html, css } = renderUnderOther()
    expect(html).toMatch(/class="other-box-root-\w+"/)
    expect(html).not.toContain('soroush-')
    expect(css).toContain('color:var(--other-palette-primary);padding:var(--other-space-2);')
    expect(css).toContain(':where(:root){--other-palette-primary:#1b5fd1;--other-space-2:8px;}')
    expect(css).not.toContain('soroush')
  })

  it('writes nothing into the default cache: its prefix is used by what renders outside the provider only', () => {
    renderUnderOther()
    expect(getEngine().cache.extract()).not.toContain('other-')
    expect(getEngine().cache.extract()).not.toContain('box-root')
    const outside = renderOnServer(
      <ThemeProvider theme={theme}>
        <Box>outside</Box>
      </ThemeProvider>
    )
    expect(outside).toMatch(/class="soroush-box-root-\w+"/)
  })

  it('keeps the options of the configured style that describe how styles are written', () => {
    const Faded = styled('p', { name: 'Faded' })(({ theme: view }) => ({
      borderTop: `1px solid ${readTheme(view).palette.accent}66`,
    }))
    const other = createCache({ key: 'other' })
    const html = renderOnServer(
      <CacheProvider value={other}>
        <ThemeProvider theme={theme}>
          <Faded />
        </ThemeProvider>
      </CacheProvider>
    )
    expect(createInstance(other).extractCritical(html).css).toContain(
      'border-top:1px solid color-mix(in srgb, var(--other-palette-accent) 40%, transparent);'
    )
  })
})
