import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff', text: '#111111' } }
const brand = { palette: { primary: '#ff0000' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** The app: an outermost provider, and a nested one around a part of the page. */
function createApp(hasServerStyleElements: boolean) {
  const style = createStyle(theme, { prefix: 'rh', hasServerStyleElements })
  const Box = style.styled('div', { name: 'Box' })(({ theme: view }) => ({
    color: view.palette.primary,
    background: view.palette.text,
  }))
  const App = () => (
    <style.ThemeProvider theme={theme} colorScheme="light">
      <Box data-testid="outer">outer</Box>
      <style.ThemeProvider theme={brand}>
        <Box data-testid="inner">inner</Box>
      </style.ThemeProvider>
    </style.ThemeProvider>
  )
  return { ...style, App }
}

/** What a server render makes of the app, with no `document`, as a server has none. */
function renderOnServer(hasServerStyleElements: boolean) {
  vi.stubGlobal('document', undefined)
  try {
    const { App, cache } = createApp(hasServerStyleElements)
    const html = renderToString(<App />)
    return { html, page: extractPageStyles(cache, html) }
  } finally {
    vi.unstubAllGlobals()
  }
}

/** The text of the root rules of the page's style elements. */
const pageRoots = () =>
  [...document.querySelectorAll('style')].flatMap((element) =>
    [...(element.sheet?.cssRules ?? [])]
      .map((rule) => rule.cssText.replace(/\s+/g, ''))
      .filter((text) => text.includes(':root'))
  )

describe('a classic server render of the outermost provider', () => {
  it('has the :root rule in the CSS of the page, and hydrates with no warning and the same markup', async () => {
    const { html, page } = renderOnServer(false)
    expect(html).toMatch(
      /^<div data-testid="outer" class="rh-box-root-\w+">outer<\/div><div class="rh-theme-/
    )
    expect(page.css).toContain(
      '@layer rh-theme{:where(:root){--rh-palette-primary:#0000ff;--rh-palette-text:#111111;color-scheme:light;}}'
    )
    expect(page.ids[0]).toMatch(/^rh-root-/)
    document.head.innerHTML = page.tag
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const wrapper = container.children[1]

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { App, cache } = createApp(false)
    await act(async () => {
      hydrateRoot(container, <App />)
    })
    expect(error).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(html)
    expect(container.children[1]).toBe(wrapper)
    // The browser cache writes the root rule itself, in place of the one of the page: the same declarations.
    expect(pageRoots()).toEqual([
      '@layerrh-theme{:where(:root){--rh-palette-primary:#0000ff;--rh-palette-text:#111111;color-scheme:light;}}',
    ])
    expect(cache.extract().ids.some((id) => id.startsWith('rh-root-'))).toBe(true)
  })
})

describe('a server render of the client build with style elements', () => {
  it('sends the :root rule as a style element, and hydrates with no warning and the same markup', async () => {
    const { html, page } = renderOnServer(true)
    expect(html).toMatch(/<style data-precedence="rh" data-href="rh-root-\w+/)
    // The markup carries the root rule, so the CSS of the page does not repeat it.
    expect(page.css).not.toContain(':where(:root)')
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const inner = container.querySelector('[data-testid="inner"]')

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { App } = createApp(true)
    await act(async () => {
      hydrateRoot(container, <App />)
    })
    expect(error).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="inner"]')).toBe(inner)
    expect(pageRoots()).toHaveLength(1)
  })
})
