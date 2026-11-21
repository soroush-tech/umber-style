import { act, render } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { createCache, createMemorySheet, type Cache } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import type { WebStyle } from './types'

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }
const dark = { palette: { primary: '#8888ff' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** A cache over a sheet in memory, so that a test reads its rules. */
function createSheetCache(prefix: string) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix, sheet, hasDevChecks: false })
  const css = () => sheet.rules.join('')
  return { sheet, cache, css }
}

/** A default style whose engine writes into a cache of its own (`base`), as an app's would. */
function setup() {
  const base = createSheetCache('base')
  const style = createDefaultStyle()
  style.configure({ cache: base.cache, theme: theme as never })
  // The default style, typed with the theme of these tests.
  return { ...(style as unknown as WebStyle<typeof theme>), base }
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

describe('a subtree under a CacheProvider', () => {
  it('writes its classes into the given cache, and a sibling outside keeps the engine cache', () => {
    const { styled, base } = setup()
    const sub = createSheetCache('sub')
    const Fixed = styled('p', { name: 'Fixed' })({ margin: 1 })
    const Themed = styled('p', { name: 'Themed' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    const { container } = render(
      <>
        <Fixed data-testid="outside" />
        <CacheProvider value={sub.cache}>
          <Fixed data-testid="inside" />
          <Themed data-testid="themed" />
        </CacheProvider>
      </>
    )
    const classOf = (id: string) =>
      (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).className
    expect(classOf('outside')).toMatch(/^base-fixed-root-/)
    expect(classOf('inside')).toMatch(/^sub-fixed-root-/)
    expect(classOf('themed')).toMatch(/^sub-themed-root-/)
    expect(sub.css()).toContain(`.${classOf('inside')}{margin:1px;}`)
    expect(sub.css()).toContain(`.${classOf('themed')}{color:var(--sub-palette-primary);}`)
    expect(base.css()).toContain(`.${classOf('outside')}{margin:1px;}`)
    expect(base.css()).not.toContain('sub-')
  })

  it('writes sheet entries and css() values made at module scope into the given cache', () => {
    const { styled, StyleSheet, useStyle, apply, css, base } = setup()
    const sub = createSheetCache('sub')
    const sheet = StyleSheet.create({ box: { padding: 2 } })
    const themed = StyleSheet.create((view: typeof theme) => ({
      text: { color: view.palette.accent },
    }))
    const value = css({ margin: 3 })
    const Box = styled('div')({ display: 'block' })
    function Content() {
      const entries = useStyle(sheet)
      const text = useStyle(themed)
      return (
        <>
          <Box data-testid="entry" style={sheet.box} />
          <Box data-testid="css" style={value} />
          <p data-testid="applied" {...apply(entries.box)} />
          <p data-testid="themed" {...apply(text.text)} />
        </>
      )
    }
    const { container } = render(
      <CacheProvider value={sub.cache}>
        <Content />
      </CacheProvider>
    )
    for (const id of ['entry', 'css', 'applied', 'themed']) {
      const names = (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).className
      for (const name of names.split(' ')) expect(name).toMatch(/^sub-/)
    }
    expect(sub.css()).toContain('{padding:2px;}')
    expect(sub.css()).toContain('{margin:3px;}')
    expect(sub.css()).toContain('{color:var(--sub-palette-accent);}')
    expect(base.sheet.rules).toEqual([])
  })

  it('declares the theme on :root, the theme classes, global rules and keyframes in the given cache', () => {
    const { styled, ThemeProvider, Global, keyframes, base } = setup()
    const sub = createSheetCache('sub')
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const Moving = styled('p')({ animation: `${fade} 1s` })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <CacheProvider value={sub.cache}>
          <ThemeProvider theme={theme}>
            <Global styles={(view: typeof theme) => ({ body: { margin: view.space[1] } })} />
            <ThemeProvider theme={dark}>
              <Moving />
            </ThemeProvider>
          </ThemeProvider>
        </CacheProvider>
      </ThemeProvider>
    )
    // The provider under the cache provider is the outermost of its cache: it renders no wrapper.
    const wrapper = container.querySelector('div') as HTMLElement
    expect(wrapper.className).toMatch(/^sub-theme-\w+ sub-boundary/)
    expect(sub.css()).toContain(':where(:root){--sub-space-1:4px;}')
    expect(sub.css()).toContain('{body{margin:var(--sub-space-1);}}')
    expect(sub.css()).toContain(`@keyframes ${fade}{`)
    expect(sub.css()).toMatch(/@layer sub-theme\{\.sub-theme-\w+\{--sub-space-1:4px;\}\}/)
    expect(base.sheet.rules.join('')).not.toContain('sub-')
    expect(base.sheet.rules.join('')).not.toContain('@keyframes')
  })

  it('uses the cache of the nearest provider', () => {
    const { styled } = setup()
    const outer = createSheetCache('outer')
    const inner = createSheetCache('inner')
    const Box = styled('p')({ margin: 1 })
    const { container } = render(
      <CacheProvider value={outer.cache}>
        <Box data-testid="outer" />
        <CacheProvider value={inner.cache}>
          <Box data-testid="inner" />
        </CacheProvider>
      </CacheProvider>
    )
    const classOf = (id: string) =>
      (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).className
    expect(classOf('outer')).toMatch(/^outer-/)
    expect(classOf('inner')).toMatch(/^inner-/)
    expect(inner.css()).not.toContain(classOf('outer'))
  })

  it('releases what its components wrote into the given cache when they unmount', async () => {
    const { styled, Global } = setup()
    const sub = createSheetCache('sub')
    const Box = styled('p')({ display: 'block' })
    let hide: () => void = () => undefined
    function Toggle() {
      const [isShown, setShown] = useState(true)
      hide = () => setShown(false)
      return isShown ? (
        <>
          <Global styles={{ body: { margin: 0 } }} />
          <Box style={{ color: 'red' }} />
        </>
      ) : null
    }
    render(
      <CacheProvider value={sub.cache}>
        <Toggle />
      </CacheProvider>
    )
    expect(sub.css()).toContain('{body{margin:0;}}')
    expect(sub.css()).toContain('{color:red;}')
    act(() => hide())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sub.css()).not.toContain('{body{margin:0;}}')
    expect(sub.css()).not.toContain('{color:red;}')
  })

  it('takes over the style of a provider whose cache is the engine own', () => {
    const own = createSheetCache('own')
    const style = createStyle(theme, { cache: own.cache })
    const Themed = style.styled('p')(({ theme: view }) => ({ color: view.palette.primary }))
    const { container } = render(
      <style.ThemeProvider theme={theme}>
        <CacheProvider value={own.cache}>
          <Themed />
        </CacheProvider>
      </style.ThemeProvider>
    )
    expect((container.querySelector('p') as HTMLElement).className).toMatch(/^own-/)
  })
})

describe('the default cache of an app', () => {
  it('is the cache of a provider around the whole tree: every class has its prefix, and the engine cache stays empty', () => {
    const style = createDefaultStyle()
    const app = createSheetCache('soroush')
    const Box = style.styled('p', { name: 'Box' })(({ theme: view }) => ({
      color: (view as unknown as typeof theme).palette.primary,
    }))
    const { container } = render(
      <CacheProvider value={app.cache}>
        <style.ThemeProvider theme={theme as never}>
          <Box />
        </style.ThemeProvider>
      </CacheProvider>
    )
    expect((container.querySelector('p') as HTMLElement).className).toMatch(/^soroush-box-root-/)
    expect(app.css()).toContain(':where(:root){--soroush-palette-primary:#0000ff;}')
    expect(style.getEngine().cache.extract().css).toBe('')
  })
})

describe('a server render under a CacheProvider', () => {
  it('sends no style element: the app sends the rules of its cache, and a Global names its sets in a marker of that cache', () => {
    const { styled, ThemeProvider, Global } = setup()
    const sub = createSheetCache('sub')
    const Box = styled('p')(({ theme: view }) => ({ color: view.palette.primary }))
    const inside = renderOnServer(
      <CacheProvider value={sub.cache}>
        <ThemeProvider theme={theme}>
          <Global styles={{ body: { margin: 0 } }} />
          <Box />
        </ThemeProvider>
      </CacheProvider>
    )
    const { id } = sub.cache.compileGlobal({ body: { margin: 0 } })
    expect(inside).not.toContain('<style')
    expect(inside).toMatch(
      new RegExp(`^<meta name="sub-global" content="${id}"/><p class="sub-\\w+">`)
    )
    expect(sub.css()).toContain('{body{margin:0;}}')
    const outside = renderOnServer(
      <ThemeProvider theme={theme}>
        <Box />
      </ThemeProvider>
    )
    expect(outside).toContain('<style')
  })

  it('hydrates in the browser over a cache that read what the server sent, with nothing written again', () => {
    const { styled, ThemeProvider } = setup()
    const server = createSheetCache('sub')
    const Box = styled('p')(({ theme: view }) => ({ color: view.palette.primary }))
    const tree = (cache: Cache) => (
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <Box>text</Box>
        </ThemeProvider>
      </CacheProvider>
    )
    const html = renderOnServer(tree(server.cache))
    const { css, ids } = server.cache.extract()
    document.head.innerHTML = `<style data-umber="sub ${ids.join(' ')}">${css}</style>`
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const browser = createSheetCache('sub')
    const error = vi.spyOn(console, 'error')
    render(tree(browser.cache), { container, hydrate: true })
    expect(error).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(html)
    // The root rule is written anew in the browser, as it is outside a cache provider; nothing else is.
    expect(browser.sheet.rules).toEqual([
      '@layer sub-theme{:where(:root){--sub-palette-primary:#0000ff;}}',
    ])
  })
})
