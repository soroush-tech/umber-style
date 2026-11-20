import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { text: '#111111' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** The app, with global styles and an animated component, made over a style of its own. */
function createApp(hasServerStyleElements = true) {
  const style = createStyle(theme, { prefix: 'hg', hasServerStyleElements })
  const fade = style.keyframes({ from: { opacity: 0 } }, { label: 'fade' })
  const base = style.globalStyles((view) => ({
    body: { margin: 0, color: view.palette.text, animation: `${fade} 1s` },
  }))
  const Box = style.styled('div', { name: 'Box' })({ animation: `${fade} 2s` })
  const App = () => (
    <style.ThemeProvider theme={theme} isRoot>
      <style.Global styles={base} />
      <Box data-testid="box">hello</Box>
    </style.ThemeProvider>
  )
  return { ...style, App, fade }
}

/** What a classic server render makes of the app, with no `document`, as a server has none: its markup, and the style element that `extractPageStyles` writes for it. */
function renderOnServer(hasServerStyleElements = true) {
  vi.stubGlobal('document', undefined)
  try {
    const { App, cache } = createApp(hasServerStyleElements)
    const html = renderToString(<App />)
    return { html, tag: extractPageStyles(cache, html).tag }
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('hydrating a page whose server render holds the style elements of Global', () => {
  it('raises no warning, keeps the markup, and writes no global or @keyframes rule again', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { html } = renderOnServer()
    expect(html.match(/@keyframes/g)).toHaveLength(1)
    expect(html).toContain('@layer hg-global{body{margin:0;')
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const box = container.querySelector('[data-testid="box"]')

    const { App, cache, fade } = createApp()
    const before = cache.extract().css
    await act(async () => {
      hydrateRoot(container, <App />)
    })
    expect(error).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="box"]')).toBe(box)
    expect(cache.extract().css).toBe(before)
    expect(cache.extract().css).not.toContain(fade)
    // The global rules are held, taken over from the page.
    expect(cache.extract().ids).toContainEqual(expect.stringMatching(/^hg-global-/))
  })

  it('raises no warning over the marker that a render without style elements sends, which the browser does not render', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { html, tag } = renderOnServer(false)
    expect(html).toMatch(/^<meta name="hg-global" content="hg-global-\w+"\/>/)
    expect(tag).toContain('@layer hg-global{body{margin:0;')
    document.head.innerHTML = tag
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const box = container.querySelector('[data-testid="box"]')

    const { App, cache } = createApp(false)
    const before = cache.extract().css
    await act(async () => {
      hydrateRoot(container, <App />)
    })
    expect(error).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="box"]')).toBe(box)
    expect(cache.extract().css).toBe(before)
    expect(cache.extract().ids).toContainEqual(expect.stringMatching(/^hg-global-/))
  })
})
