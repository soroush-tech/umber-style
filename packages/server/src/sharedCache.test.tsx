import { createCache, createDomSheet } from '@umber-style/core'
import createCssInstance from '@umber-style/css/create-instance'
import { CacheProvider, createStyle } from '@umber-style/react'
import { renderToString } from 'react-dom/server'
import createInstance from './createInstance'

const theme = { palette: { primary: '#1b5fd1' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('one cache for the css package and a styled component under a CacheProvider', () => {
  it('holds the rules of both in one style element, and the server instance extracts them together', () => {
    const sheet = createDomSheet('app')
    const cache = createCache({ prefix: 'app', sheet, hasDevChecks: false })
    const { css } = createCssInstance({ cache, sheet })
    const { styled, ThemeProvider } = createStyle(theme)
    const Box = styled('p', { name: 'Box' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    const badge = css({ margin: 4 })
    const html = renderToString(
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <Box>text</Box>
          <span className={badge} />
        </ThemeProvider>
      </CacheProvider>
    )
    const boxClass = /app-box-root-\w+/.exec(html)?.[0] as string

    const elements = document.querySelectorAll<HTMLStyleElement>('style[data-style="app"]')
    expect(elements).toHaveLength(1)
    const written = [...(elements[0].sheet?.cssRules ?? [])].map((rule) => rule.cssText).join('')
    expect(written).toContain(`.${badge}`)
    expect(written).toContain(`.${boxClass}`)

    const { css: extracted, ids } = createInstance(cache).extractCritical(html)
    expect(ids).toEqual(expect.arrayContaining([badge, boxClass]))
    expect(extracted).toContain(`.${badge}{margin:4px;}`)
    expect(extracted).toContain(`.${boxClass}{color:var(--app-palette-primary);}`)
  })
})
