import { type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { createStyle } from './createStyle'

const light = { palette: { text: '#ff0000', surface: '#ffffff' } }
const dark = { palette: { text: '#0000ff', surface: '#000000' } }

let count = 0
const roots: Root[] = []

afterEach(() => {
  for (const root of roots.splice(0)) flushSync(() => root.unmount())
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.className = ''
})

/** A real React render into the real document, with its own engine and style element. */
function setup() {
  const prefix = `tp${++count}`
  const style = createStyle(light, { prefix })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  const render = (node: ReactNode) => flushSync(() => root.render(node))
  const Text = style.styled('p', { name: 'Text' })(({ theme: view }) => ({
    color: view.palette.text,
  }))
  const read = (element: Element, name: 'text' | 'surface') =>
    getComputedStyle(element).getPropertyValue(`--${prefix}-palette-${name}`)
  return { ...style, prefix, container, render, Text, read }
}

const RED = 'rgb(255, 0, 0)'
const BLUE = 'rgb(0, 0, 255)'
const GREEN = 'rgb(0, 128, 0)'

describe('the outermost provider in a real browser', () => {
  it('declares its theme on :root, so <html>, <body> and Global rules for them see it', () => {
    const { ThemeProvider, Global, render, Text, read } = setup()
    render(
      <ThemeProvider theme={light} colorScheme="dark">
        <Global styles={(view: typeof light) => ({ body: { color: view.palette.text } })} />
        <Text>text</Text>
      </ThemeProvider>
    )
    expect(document.documentElement.className).toBe('')
    expect(read(document.documentElement, 'text')).toBe('#ff0000')
    expect(getComputedStyle(document.body).color).toBe(RED)
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark')
  })

  it('switches every element when its theme changes, by the :root rule', () => {
    const { ThemeProvider, render, Text } = setup()
    const content = <Text>text</Text>
    render(<ThemeProvider theme={light}>{content}</ThemeProvider>)
    const text = document.querySelector('p') as HTMLElement
    expect(getComputedStyle(text).color).toBe(RED)
    render(<ThemeProvider theme={dark}>{content}</ThemeProvider>)
    expect(getComputedStyle(text).color).toBe(BLUE)
  })

  it('loses to a theme class on <html>: the static page that switches its class keeps working', () => {
    const { ThemeProvider, themeClass, render, Text } = setup()
    render(
      <ThemeProvider theme={light}>
        <Text>text</Text>
      </ThemeProvider>
    )
    document.documentElement.className = themeClass(dark)
    expect(getComputedStyle(document.querySelector('p') as HTMLElement).color).toBe(BLUE)
  })
})

describe('a nested provider in a real browser', () => {
  it('gives its variables to everything inside its wrapper, plain elements too', () => {
    const { ThemeProvider, render, Text, read } = setup()
    render(
      <ThemeProvider theme={light}>
        <Text>outer</Text>
        <ThemeProvider theme={{ palette: { text: 'green' } }}>
          <span>plain</span>
          <Text>inner</Text>
        </ThemeProvider>
      </ThemeProvider>
    )
    const wrapper = document.querySelector('span')?.parentElement as HTMLElement
    expect(getComputedStyle(wrapper).display).toBe('contents')
    expect(read(document.querySelector('span') as HTMLElement, 'text')).toBe('green')
    const [outer, inner] = document.querySelectorAll('p')
    expect(getComputedStyle(outer).color).toBe(RED)
    expect(getComputedStyle(inner).color).toBe(GREEN)
  })

  it('reaches portal content through ThemeScope; without it the portal sees the outer theme', () => {
    const { ThemeProvider, ThemeScope, render, Text } = setup()
    const target = document.createElement('div')
    document.body.appendChild(target)
    render(
      <ThemeProvider theme={light}>
        <ThemeProvider theme={dark}>
          {createPortal(
            <>
              <ThemeScope>
                <Text>scoped</Text>
              </ThemeScope>
              <Text>bare</Text>
            </>,
            target
          )}
        </ThemeProvider>
      </ThemeProvider>
    )
    const [scoped, bare] = target.querySelectorAll('p')
    expect(getComputedStyle(scoped).color).toBe(BLUE)
    expect(getComputedStyle(bare).color).toBe(RED)
  })

  it('shows its own merged theme inside portal content, under a nested provider of the tree', () => {
    const { ThemeProvider, render, Text, read, engine } = setup()
    // A rule that uses the surface, so that the themes declare it.
    engine.css({ background: engine.refs.palette.surface })
    const target = document.createElement('div')
    document.body.appendChild(target)
    render(
      <ThemeProvider theme={light}>
        <ThemeProvider theme={{ palette: { surface: '#123456' } }}>
          {createPortal(
            <ThemeProvider theme={{ palette: { text: 'green' } }}>
              <Text>portal</Text>
            </ThemeProvider>,
            target
          )}
        </ThemeProvider>
      </ThemeProvider>
    )
    const portal = target.querySelector('p') as HTMLElement
    expect(getComputedStyle(portal).color).toBe(GREEN)
    // The surface of the provider between them in the tree, though the portal is not inside its wrapper.
    expect(read(portal, 'surface')).toBe('#123456')
  })
})
