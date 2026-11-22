import createUmberCache, { type UmberSheet } from '@umber-style/cache'
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

  it('takes a cache of @umber-style/cache as it is, and extracts both classes in the layers of that cache', () => {
    const cache = createUmberCache({ key: 'shop', hasDevChecks: false })
    const instance = createCssInstance({ cache })
    expectTypeOf(instance.sheet).toEqualTypeOf<UmberSheet>()
    expect(instance.sheet).toBe(cache.sheet)
    expect(instance.cache).toBe(cache)
    const { styled, ThemeProvider } = createStyle(theme)
    const Box = styled('p', { name: 'Box' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    const badge = instance.css({ margin: 4 })
    const html = renderToString(
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <Box>text</Box>
          <span className={badge} />
        </ThemeProvider>
      </CacheProvider>
    )
    const boxClass = /shop-box-root-\w+/.exec(html)?.[0] as string
    expect(cache.hasLayers).toBe(true)

    const { css: extracted, ids } = createInstance(cache).extractCritical(html)
    expect(ids).toEqual(expect.arrayContaining([badge, boxClass]))
    expect(extracted).toContain(cache.layerOrder)
    expect(extracted).toContain(`@layer shop-components{.${badge}{margin:4px;}}`)
    expect(extracted).toContain(
      `@layer shop-components{.${boxClass}{color:var(--shop-palette-primary);}}`
    )
    expect(Object.keys(cache.inserted)).toEqual(expect.arrayContaining([badge, boxClass]))
  })

  it('keeps the classes of the css package out of a layer when the cache of @umber-style/cache has none', () => {
    const cache = createUmberCache({ key: 'flat', hasLayers: false, hasDevChecks: false })
    const badge = createCssInstance({ cache }).css({ margin: 4 })
    const { css: extracted } = createInstance(cache).extractCritical(
      `<span class="${badge}"></span>`
    )
    expect(extracted).toBe(`.${badge}{margin:4px;}`)
  })
})
