import { act, StrictMode, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { bindEngine as bindClient } from './createStyle'
import { bindEngine as bindServer } from './createStyle.server'
import { keepRootRule, ProviderScope } from './ProviderScope'
import type { CacheFunction } from './serverContext'

// The server build of the provider, rendered by the client build of React as a server of server
// components renders it: its function runs, and `ProviderScope`, a client component, is real here. Each
// `bindServer` has slots of its own: one request. A partial render is a provider rendered in a request of
// its own, under the provider of another request that is already mounted.

const light = {
  palette: { primary: '#0000ff', text: '#111111', surface: '#ffffff' },
  breakpoints: ['600px'],
}
const dark = {
  palette: { primary: '#8ab4ff', text: '#f2f2f2', surface: '#101114' },
  breakpoints: ['600px'],
}
const brand = { palette: { surface: '#fff4d6' } }
const accent = { palette: { primary: '#0b7a4b' } }

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

let roots: Root[] = []
// React keeps a style element it hoisted for the life of the document, by its href: each test has a
// prefix of its own, so that its elements are its own.
let count = 0
let p = 'ps'
beforeEach(() => {
  count += 1
  p = `ps${count}`
})

afterEach(() => {
  for (const root of roots) act(() => root.unmount())
  roots = []
  // The head keeps the elements that React hoisted: it would not write them again.
  for (const element of document.head.querySelectorAll('style')) element.remove()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** One engine and the parts of the page: a request of the server build is `request()`, and the client build. */
function setup() {
  const engine = createEngine(light, { prefix: p })
  const request = () => bindServer(engine, requestCache)
  const client = bindClient(engine)
  return { engine, request, client }
}

/** Renders `node` in a new root, in `act`, and returns its container. */
function mount(node: ReactNode): { container: HTMLElement; render(next: ReactNode): void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => root.render(node))
  return { container, render: (next) => act(() => root.render(next)) }
}

/** The style elements that React put in the head for `prefix`. */
const styleElements = () => [
  ...document.head.querySelectorAll<HTMLStyleElement>(`style[data-precedence="${p}"]`),
]

/** The text of every root rule that is live in the style elements of the document, without spaces. */
const liveRoots = () =>
  [...document.querySelectorAll('style')].flatMap((element) =>
    [...(element.sheet?.cssRules ?? [])]
      .map((rule) => rule.cssText.replace(/\s+/g, ''))
      .filter((text) => text.includes(':where(:root)'))
  )

/** The class string of the wrapper of a nested provider of the server build. */
const wrapperPattern = () => new RegExp(String.raw`^${p}-theme-\w+ ${p}-boundary ${p}-scope$`)

/** The elements of the theme wrappers in `container`. */
const wrappers = (container: HTMLElement) => [...container.querySelectorAll(`.${p}-scope`)]

describe('the browser part of a provider of the server build', () => {
  it('in a full render: the layout provider is the outermost one, the page provider is nested', () => {
    const { request } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <ThemeProvider theme={light}>
        <i data-testid="outer" />
        <ThemeProvider theme={brand}>
          <b data-testid="inner" />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(container.firstElementChild?.tagName).toBe('I')
    const [wrapper] = wrappers(container)
    expect(wrapper.className).toMatch(wrapperPattern())
    expect(wrapper.querySelector('b')).not.toBeNull()
    expect(liveRoots()).toEqual([
      `@layer${p}-theme{:where(:root){--${p}-palette-primary:#0000ff;--${p}-palette-text:#111111;--${p}-palette-surface:#ffffff;}}`,
    ])
    const hrefs = styleElements().map((element) => element.dataset.href)
    expect(hrefs[0]).toMatch(new RegExp(`^${p}-root-`))
    expect(hrefs).toContain(wrapper.className.split(' ')[0])
    expect(hrefs).toContain(`${p}-scope`)
  })

  it('in a partial render: a page provider rendered alone is nested under the layout provider mounted in the browser', () => {
    const { request } = setup()
    const layout = request()
    // The navigation renders the page in a request of its own: its provider is the first one there.
    const page = request()
    const { container } = mount(
      <layout.ThemeProvider theme={light}>
        <page.ThemeProvider theme={brand}>
          <b />
        </page.ThemeProvider>
      </layout.ThemeProvider>
    )
    const found = wrappers(container)
    expect(found).toHaveLength(1)
    expect(found[0].querySelector('b')).not.toBeNull()
    expect(liveRoots()).toHaveLength(1)
    expect(liveRoots()[0]).toContain(`--${p}-palette-surface:#ffffff;`)
  })

  it('in a partial render of two levels and of one: every provider below the outermost is nested', () => {
    const { request } = setup()
    const [first, second, third] = [request(), request(), request()]
    const { container } = mount(
      <first.ThemeProvider theme={light}>
        <second.ThemeProvider theme={brand}>
          <third.ThemeProvider theme={accent}>
            <b />
          </third.ThemeProvider>
        </second.ThemeProvider>
      </first.ThemeProvider>
    )
    const found = wrappers(container)
    expect(found).toHaveLength(2)
    expect(found[0].contains(found[1])).toBe(true)
    expect(liveRoots()).toHaveLength(1)
  })

  it('with no provider above, a page provider is the outermost one: the base theme, then its own, on :root', () => {
    const { request } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <ThemeProvider theme={brand} colorScheme="dark">
        <b />
      </ThemeProvider>
    )
    expect(wrappers(container)).toEqual([])
    // The rule declares the surface twice, the base value then its own: the browser keeps the last one.
    expect(liveRoots()).toEqual([
      `@layer${p}-theme{:where(:root){--${p}-palette-primary:#0000ff;--${p}-palette-text:#111111;--${p}-palette-surface:#fff4d6;color-scheme:dark;}}`,
    ])
    expect(
      getComputedStyle(document.documentElement).getPropertyValue(`--${p}-palette-surface`)
    ).toBe('#fff4d6')
  })

  it('with nothing above two sibling providers, the first is the outermost one, the second renders its wrapper', () => {
    const { request } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <>
        <ThemeProvider theme={brand}>
          <b />
        </ThemeProvider>
        <ThemeProvider theme={accent}>
          <u />
        </ThemeProvider>
      </>
    )
    const found = wrappers(container)
    expect(found).toHaveLength(1)
    expect(found[0].querySelector('u')).not.toBeNull()
    expect(liveRoots()).toHaveLength(1)
    expect(liveRoots()[0]).toContain(`--${p}-palette-surface:#fff4d6;`)
  })

  it('under a provider with isRoot, a page provider is nested; isRoot itself renders nothing', () => {
    const { request, engine } = setup()
    const layout = request()
    layout.themeClass(light)
    const page = request()
    const { container } = mount(
      <layout.ThemeProvider theme={light} isRoot>
        <page.ThemeProvider theme={brand}>
          <b />
        </page.ThemeProvider>
      </layout.ThemeProvider>
    )
    expect(wrappers(container)).toHaveLength(1)
    expect(liveRoots()).toEqual([])
    expect(styleElements().map((element) => element.dataset.href)).toContain(engine.themeId(light))
  })

  it('two sibling providers under one outer provider are both nested, each with its theme', () => {
    const { request } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <ThemeProvider theme={light}>
        <ThemeProvider theme={brand}>
          <b />
        </ThemeProvider>
        <ThemeProvider theme={accent}>
          <u />
        </ThemeProvider>
      </ThemeProvider>
    )
    const found = wrappers(container)
    expect(found).toHaveLength(2)
    expect(found[0].className).not.toBe(found[1].className)
  })

  it('a theme equal to the outer one, and an empty one, are nested: the first declares every variable, the second none', () => {
    const { request } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <ThemeProvider theme={light}>
        <ThemeProvider theme={light}>
          <b />
        </ThemeProvider>
        <ThemeProvider theme={{}}>
          <u />
        </ThemeProvider>
      </ThemeProvider>
    )
    const [same, empty] = wrappers(container)
    expect(same.className).toMatch(wrapperPattern())
    expect(empty.className).toBe(`${p}-theme-0 ${p}-boundary ${p}-scope`)
    const hrefs = styleElements().map((element) => element.dataset.href)
    expect(hrefs).toContain(same.className.split(' ')[0])
    expect(hrefs).not.toContain(`${p}-theme-0`)
  })

  it('gives a function theme the root theme of its request: in a partial render, the base theme', () => {
    const { request } = setup()
    const layout = request()
    const page = request()
    const seen: string[] = []
    const surface = (outer: typeof light) => {
      seen.push(outer.palette.surface)
      return { palette: { text: outer.palette.surface } }
    }
    mount(
      <layout.ThemeProvider theme={dark}>
        <layout.ThemeProvider theme={surface}>
          <b />
        </layout.ThemeProvider>
        <page.ThemeProvider theme={surface}>
          <u />
        </page.ThemeProvider>
      </layout.ThemeProvider>
    )
    expect(seen).toEqual(['#101114', '#ffffff'])
  })

  it('renders its children with no element and no style for a provider with isRoot and nothing above', () => {
    const { request } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <ThemeProvider theme={light} isRoot>
        <b />
      </ThemeProvider>
    )
    expect(container.innerHTML).toBe('<b></b>')
  })
})

describe('the browser part of a provider of the server build, with the client build', () => {
  it('is nested under a provider of the client build', () => {
    const { request, client } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <client.ThemeProvider theme={light}>
        <ThemeProvider theme={brand}>
          <b />
        </ThemeProvider>
      </client.ThemeProvider>
    )
    expect(wrappers(container)).toHaveLength(1)
    // The root rule is the client provider's, which declares the variables that rules use: none here.
    expect(liveRoots()).toEqual([])
  })

  it('makes a provider of the client build below it nested, with the theme class of its own theme only', () => {
    const { request, client, engine } = setup()
    const { ThemeProvider } = request()
    let below: string | undefined
    const Probe = () => {
      below = client.useThemeClass()
      return null
    }
    const { container } = mount(
      <ThemeProvider theme={dark}>
        <client.ThemeProvider theme={brand}>
          <Probe />
        </client.ThemeProvider>
      </ThemeProvider>
    )
    const [wrapper] = wrappers(container)
    // No class of a merged theme: the theme of the server provider above is not in the client context.
    expect(wrapper.className).toBe(`${engine.themeClass(brand)} ${p}-scope`)
    expect(below).toBe(wrapper.className)
    expect(liveRoots()).toHaveLength(1)
  })

  it('gives ThemeScope and useThemeClass its wrapper, for portal content, and a provider inside the portal is nested', () => {
    const { request, client, engine } = setup()
    const { ThemeProvider } = request()
    const target = document.createElement('section')
    document.body.appendChild(target)
    let classInPortal: string | undefined
    const Probe = () => {
      classInPortal = client.useThemeClass()
      return null
    }
    const Dialog = () =>
      createPortal(
        <>
          <client.ThemeScope>
            <b data-testid="scoped" />
          </client.ThemeScope>
          <i data-testid="bare" />
          <client.ThemeProvider theme={accent}>
            <u data-testid="provided" />
          </client.ThemeProvider>
          <Probe />
        </>,
        target
      )
    mount(
      <ThemeProvider theme={light}>
        <ThemeProvider theme={brand}>
          <Dialog />
        </ThemeProvider>
      </ThemeProvider>
    )
    const brandClass = `${engine.themeClass(brand)} ${p}-scope`
    expect(classInPortal).toBe(brandClass)
    expect(target.querySelector('[data-testid="scoped"]')?.parentElement?.className).toBe(
      brandClass
    )
    expect(target.querySelector('[data-testid="bare"]')?.parentElement).toBe(target)
    expect(target.querySelector('[data-testid="provided"]')?.parentElement?.className).toBe(
      `${engine.themeClass(accent)} ${p}-scope`
    )
  })

  it('is nested under a provider of the client build that has isRoot, and passes no wrapper down with isRoot', () => {
    const { request, client } = setup()
    const { ThemeProvider } = request()
    let classAtRoot: string | undefined = 'unset'
    const Probe = () => {
      classAtRoot = client.useThemeClass()
      return null
    }
    const { container } = mount(
      <client.ThemeProvider theme={light} isRoot>
        <ThemeProvider theme={light} isRoot>
          <Probe />
          <ThemeProvider theme={brand}>
            <b />
          </ThemeProvider>
        </ThemeProvider>
      </client.ThemeProvider>
    )
    expect(classAtRoot).toBeUndefined()
    expect(wrappers(container)).toHaveLength(1)
  })

  it('under a provider with isRoot of the server build, a nested client provider keeps the class of its merged theme', () => {
    const { request, client, engine } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <ThemeProvider theme={light} isRoot>
        <client.ThemeProvider theme={light} isRoot>
          <client.ThemeProvider theme={brand}>
            <b />
          </client.ThemeProvider>
        </client.ThemeProvider>
      </ThemeProvider>
    )
    const [wrapper] = wrappers(container)
    const full = engine.themeId({ ...light, palette: { ...light.palette, ...brand.palette } })
    expect(wrapper.className).toBe(`${engine.themeClass(brand)} ${full} ${p}-scope`)
  })

  it('under a CacheProvider, still renders its style elements, once each, and stays nested', () => {
    const { request } = setup()
    const { ThemeProvider } = request()
    const cache = createCache({ prefix: p, sheet: createMemorySheet() })
    const { container } = mount(
      <CacheProvider value={cache}>
        <ThemeProvider theme={light}>
          <ThemeProvider theme={brand}>
            <b />
          </ThemeProvider>
          <ThemeProvider theme={brand}>
            <u />
          </ThemeProvider>
        </ThemeProvider>
      </CacheProvider>
    )
    expect(wrappers(container)).toHaveLength(2)
    const hrefs = styleElements().map((element) => element.dataset.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(liveRoots()).toHaveLength(1)
  })
})

describe('one live root rule', () => {
  it('when the outermost theme changes from the server and back, only the current root rule is live', () => {
    const { request } = setup()
    const first = request()
    const tree = (provider: typeof first, theme: typeof light, scheme: 'light' | 'dark') => (
      <provider.ThemeProvider theme={theme} colorScheme={scheme}>
        <provider.ThemeProvider theme={brand}>
          <b />
        </provider.ThemeProvider>
      </provider.ThemeProvider>
    )
    const { container, render } = mount(tree(first, light, 'light'))
    const surface = () =>
      getComputedStyle(document.documentElement).getPropertyValue(`--${p}-palette-text`)
    expect(surface()).toBe('#111111')
    // A refresh renders the root layout again with the other theme: a new request.
    render(tree(request(), dark, 'dark'))
    expect(liveRoots()).toHaveLength(1)
    expect(liveRoots()[0]).toContain('color-scheme:dark')
    expect(surface()).toBe('#f2f2f2')
    // React kept the element of the first root rule; going back writes that rule again there.
    render(tree(request(), light, 'light'))
    expect(
      styleElements().filter((element) => element.dataset.href?.startsWith(`${p}-root-`))
    ).toHaveLength(2)
    expect(liveRoots()).toHaveLength(1)
    expect(liveRoots()[0]).toContain('color-scheme:light')
    expect(surface()).toBe('#111111')
    expect(wrappers(container)).toHaveLength(1)
  })

  it('in strict mode: one wrapper, one root rule', () => {
    const { request } = setup()
    const { ThemeProvider } = request()
    const { container } = mount(
      <StrictMode>
        <ThemeProvider theme={light}>
          <ThemeProvider theme={brand}>
            <b />
          </ThemeProvider>
        </ThemeProvider>
      </StrictMode>
    )
    expect(wrappers(container)).toHaveLength(1)
    expect(liveRoots()).toHaveLength(1)
  })

  it('leaves the root rules of the browser cache alone, and changes nothing while the element of its rule is not there', () => {
    const cacheElement = document.createElement('style')
    cacheElement.dataset.style = 'ps'
    cacheElement.textContent = '@layer ps-theme{:where(:root){--a:1;}}'
    const other = document.createElement('style')
    other.dataset.precedence = 'ps'
    other.dataset.href = 'ps-root-other'
    other.textContent = ':where(:root){--b:1;}.x{color:red}'
    document.head.append(cacheElement, other)
    keepRootRule('ps', 'ps-root-mine', ':where(:root){--c:1;}', document)
    expect(liveRoots()).toEqual(
      [':where(:root){--a:1;}', ':where(:root){--b:1;}'].map((text) =>
        text.startsWith(':where') && text.includes('--a')
          ? '@layerps-theme{:where(:root){--a:1;}}'
          : text
      )
    )
    const mine = document.createElement('style')
    mine.dataset.precedence = 'ps'
    mine.dataset.href = 'ps-root-mine x'
    mine.textContent = '.y{color:blue}'
    document.head.append(mine)
    keepRootRule('ps', 'ps-root-mine', ':where(:root){--c:1;}', document)
    expect(liveRoots()).toEqual(['@layerps-theme{:where(:root){--a:1;}}', ':where(:root){--c:1;}'])
    expect(other.sheet?.cssRules).toHaveLength(1)
  })
})

describe('the first HTML and hydration', () => {
  it('chooses on the server as in the browser, and hydrates with no warning and the same markup', async () => {
    const { request } = setup()
    const App = ({ style }: { style: ReturnType<typeof request> }) => (
      <html>
        <body>
          <style.ThemeProvider theme={light}>
            <p>outer</p>
            <style.ThemeProvider theme={brand}>
              <b>inner</b>
            </style.ThemeProvider>
          </style.ThemeProvider>
        </body>
      </html>
    )
    vi.stubGlobal('document', undefined)
    const html = renderToString(<App style={request()} />)
    vi.unstubAllGlobals()
    expect(html).toMatch(
      new RegExp(
        String.raw`<div class="${p}-theme-\w+ ${p}-boundary ${p}-scope"><b>inner</b></div>`
      )
    )
    expect(html.match(/:where\(:root\)/g)).toHaveLength(1)
    document.documentElement.innerHTML = html.replace(/^<html>|<\/html>$/g, '')
    const wrapper = document.querySelector(`.${p}-scope`)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await act(async () => {
      roots.push(hydrateRoot(document, <App style={request()} />) as unknown as Root)
    })
    expect(error).not.toHaveBeenCalled()
    expect(document.querySelector(`.${p}-scope`)).toBe(wrapper)
    expect(liveRoots()).toHaveLength(1)
  })
})

describe('a theme with no variable', () => {
  it('sends no root rule for the outermost provider', () => {
    const engine = createEngine({ breakpoints: ['600px'] }, { prefix: p })
    const { ThemeProvider } = bindServer(engine, requestCache)
    mount(
      <ThemeProvider theme={{ breakpoints: ['300px'] }}>
        <b />
      </ThemeProvider>
    )
    expect(styleElements()).toEqual([])
  })
})

describe('ProviderScope alone', () => {
  it('renders the children of a provider with isRoot under no other one', () => {
    const { container } = mount(
      <ProviderScope prefix={p}>
        <b />
      </ProviderScope>
    )
    expect(container.innerHTML).toBe('<b></b>')
  })
})
