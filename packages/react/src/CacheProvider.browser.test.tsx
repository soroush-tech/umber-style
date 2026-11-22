import { type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { createCache, createDomSheet } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'

const theme = { palette: { text: '#ff0000', surface: '#00ff00' } }

const roots: Root[] = []

afterEach(() => {
  for (const root of roots.splice(0)) flushSync(() => root.unmount())
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** A real React render into the real document. */
function renderInPage(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  flushSync(() => root.render(node))
}

/** The CSS text of every style element of `page`. */
function readCss(page: Document): string {
  return [...page.querySelectorAll('style')]
    .flatMap((element) => [...(element.sheet?.cssRules ?? [])].map((rule) => rule.cssText))
    .join('\n')
}

const RED = 'rgb(255, 0, 0)'
const GREEN = 'rgb(0, 255, 0)'

describe('a subtree rendered into an iframe under a CacheProvider', () => {
  it('is styled by the rules of its own cache in the iframe document, and the page keeps its own', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frame = iframe.contentDocument as Document
    const frameWindow = iframe.contentWindow as Window
    const frameCache = createCache({ prefix: 'frame', sheet: createDomSheet('frame', frame.head) })
    const style = createStyle(theme, { prefix: 'main' })
    const Text = style.styled('p', { name: 'Text' })(({ theme: view }) => ({
      color: view.palette.text,
      background: view.palette.surface,
    }))
    renderInPage(
      <style.ThemeProvider theme={theme}>
        <Text data-testid="main">main</Text>
        <CacheProvider value={frameCache}>
          {createPortal(
            <style.ThemeProvider theme={theme}>
              <style.Global styles={{ body: { margin: 0 } }} />
              <Text data-testid="framed">framed</Text>
            </style.ThemeProvider>,
            frame.body
          )}
        </CacheProvider>
      </style.ThemeProvider>
    )
    const main = document.querySelector('[data-testid="main"]') as HTMLElement
    const framed = frame.querySelector('[data-testid="framed"]') as HTMLElement
    expect(main.className).toMatch(/^main-text-root-/)
    expect(framed.className).toMatch(/^frame-text-root-/)
    expect(getComputedStyle(main).color).toBe(RED)
    expect(frameWindow.getComputedStyle(framed).color).toBe(RED)
    expect(frameWindow.getComputedStyle(framed).backgroundColor).toBe(GREEN)
    expect(frameWindow.getComputedStyle(frame.body).marginTop).toBe('0px')
    expect(
      frameWindow.getComputedStyle(frame.documentElement).getPropertyValue('--frame-palette-text')
    ).toBe('#ff0000')
    expect(readCss(frame)).not.toContain('main-')
    expect(readCss(document)).not.toContain('frame-')
  })
})
