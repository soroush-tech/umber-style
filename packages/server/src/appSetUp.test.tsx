import createCache from '@umber-style/cache'
import {
  CacheProvider,
  configure,
  css,
  Global,
  styled,
  ThemeProvider,
  type Theme,
} from '@umber-style/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import createInstance from './createInstance'

const theme = {
  colorScheme: 'light',
  palette: { primary: { main: '#1b5fd1' } },
  border: { default: '#d0d7de' },
  background: { primary: '#ffffff' },
  text: { initial: '#111111' },
  fontSizes: [12, 14],
  breakpoints: {
    values: { lg: 1200 },
    up: (key: 'lg') => `@media (min-width: ${theme.breakpoints.values[key]}px)`,
  },
}
type AppTheme = typeof theme

// The library's set-up: configured before the first `styled`.
configure({ prefix: 'soroush', hasValueRepair: true, rawKeys: ['breakpoints'] })

// The default style is typed with the `Theme` an app declares; this file reads its own shape.
const readTheme = (theme: Theme) => theme as unknown as AppTheme

const Button = styled('button', { name: 'Button' })(({ theme }) => {
  const view = readTheme(theme)
  return {
    ':active': { backgroundColor: `${view.palette.primary.main}20` },
    borderTop: `1px solid ${view.border.default}66`,
    fontSize: `${view.fontSizes[0]}px`,
  }
})

/** The app's reset: a function of the theme that returns a `css` template. */
const globalReset = (theme: Theme) => {
  const view = readTheme(theme)
  return css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    html,
    body {
      margin: 0;
      color-scheme: ${view.colorScheme};
    }
    /* the page */
    body {
      background: ${view.background.primary};
      color: ${view.text.initial};
    }
    #root,
    main [id] {
      isolation: isolate;
    }
    ${view.breakpoints.up('lg')} {
      main [id] {
        scroll-margin-top: 5rem;
      }
    }
  `
}

/** Renders where there is no document, as a server does. */
function renderOnServer(node: ReactNode): string {
  vi.stubGlobal('document', undefined)
  try {
    return renderToString(node)
  } finally {
    vi.unstubAllGlobals()
  }
}

/** The style elements of a page of the app, rendered under `CacheProvider` and extracted as the app does. */
function renderPage(styles: Parameters<typeof Global>[0]['styles']): string {
  const styleCache = createCache({ key: 'soroush' })
  const html = renderOnServer(
    <CacheProvider value={styleCache}>
      <ThemeProvider theme={theme}>
        <Global styles={styles} />
        <Button>go</Button>
      </ThemeProvider>
    </CacheProvider>
  )
  const { extractCriticalToChunks, constructStyleTagsFromChunks } = createInstance(styleCache)
  return constructStyleTagsFromChunks(extractCriticalToChunks(html))
}

describe('the set-up of an app: a provided cache, a configured style and the server instance', () => {
  it('writes the reset, a function of the theme that returns a css template, as global rules', () => {
    const tags = renderPage(globalReset)
    expect(tags).toContain(
      '@layer soroush-global{*,*::before,*::after{box-sizing:border-box;}}' +
        '@layer soroush-global{html,body{margin:0;color-scheme:var(--soroush-color-scheme);}}' +
        '@layer soroush-global{body{background:var(--soroush-background-primary);color:var(--soroush-text-initial);}}' +
        '@layer soroush-global{#root,main [id]{isolation:isolate;}}' +
        '@layer soroush-global{@media (min-width: 1200px){main [id]{scroll-margin-top:5rem;}}}'
    )
  })

  it('repairs the token maths of a component under the provided cache, a length unit too, as the configured style says', () => {
    const tags = renderPage(null)
    expect(tags).toContain(
      ':active{background-color:color-mix(in srgb, var(--soroush-palette-primary-main) 12.55%, transparent);}'
    )
    expect(tags).toContain(
      'border-top:1px solid color-mix(in srgb, var(--soroush-border-default) 40%, transparent);font-size:var(--soroush-font-sizes-0);'
    )
  })

  it('writes a list of an object and the reset, in order', () => {
    const tags = renderPage([{ '#app': { minHeight: '100%' } }, globalReset])
    expect(tags).toContain(
      '@layer soroush-global{#app{min-height:100%;}}@layer soroush-global{*,*::before,*::after{'
    )
  })
})
