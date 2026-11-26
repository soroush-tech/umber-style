import createCache from '@umber-style/cache'
import { createEngine, setNonceSource } from '@umber-style/core'
import { act, useId, useState, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import type { CacheFunction } from './serverContext'

// `StyleRegistry` of `@umber-style/react/next`, with a stand-in for the hook of Next.js: the callbacks it
// is given are called once the render is done, as the framework calls them on a flush. The modules are
// loaded again for each test, as a new page loads them (`NonceStyles` keeps what it wrote for the page).

const inserted = vi.hoisted(() => ({ callbacks: [] as (() => unknown)[] }))
vi.mock('next/navigation', () => ({
  useServerInsertedHTML(callback: () => unknown) {
    inserted.callbacks.push(callback)
  },
}))

let roots: Root[] = []

// The roots of these tests are React's own, not those of the testing library, which says so itself.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  for (const root of roots) act(() => root.unmount())
  roots = []
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  setNonceSource(undefined)
  vi.restoreAllMocks()
})

/** The modules as a new page loads them. */
async function load() {
  vi.resetModules()
  const { StyleRegistry } = await import('./next')
  const { createStyle } = await import('./createStyle')
  const { CacheProvider } = await import('./CacheProvider')
  return { StyleRegistry, createStyle, CacheProvider }
}

/** One request where there is no document, as a server renders it: the HTML, then what each flush writes. */
function renderOnServer(node: ReactNode) {
  inserted.callbacks = []
  vi.stubGlobal('document', undefined)
  try {
    const html = renderToString(node)
    const flushes = inserted.callbacks.map((callback) =>
      renderToStaticMarkup(<>{callback() as ReactNode}</>)
    )
    return { html, head: flushes.join(''), flushes }
  } finally {
    vi.unstubAllGlobals()
  }
}

/** Hydrates `node` over `html` in a container of the body. */
async function hydrate(html: string, node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.append(container)
  await act(async () => {
    roots.push(hydrateRoot(container, node))
  })
  return container
}

/** `node` mounted in the browser after the first HTML, as a client-side navigation mounts a page. */
function mount(node: ReactNode): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => root.render(node))
  return container
}

const theme = { palette: { primary: '#1b5fd1', accent: '#d11b5f' }, space: [0, 4, 8] }

describe('StyleRegistry with the cache of a request', () => {
  it('writes what the registry an app writes by hand writes, for the same page', async () => {
    const { StyleRegistry, createStyle, CacheProvider } = await load()
    const { useServerInsertedHTML } = await import('next/navigation')
    const { styled, ThemeProvider, keyframes, Global } = createStyle(theme)
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const Hero = styled('section', { name: 'Hero' })(({ theme: view }) => ({
      color: view.palette.primary,
      padding: view.space[2],
      animation: `${fade} 1s`,
    }))
    const Page = () => (
      <ThemeProvider theme={theme}>
        <Global styles={{ body: { margin: 0 } }} />
        <Hero>Hello</Hero>
      </ThemeProvider>
    )
    // The registry of docs/cache-and-server.md, as an app writes it.
    function HandWritten({ children }: { children: ReactNode }) {
      const [{ cache, flush }] = useState(() => {
        const made = createCache({ key: 'soroush' })
        made.compat = true
        const prevInsert = made.insert
        let names: string[] = []
        made.insert = (...args) => {
          if (made.inserted[args[1].name] === undefined) names.push(args[1].name)
          return prevInsert(...args)
        }
        const take = () => {
          const taken = names
          names = []
          return taken
        }
        return { cache: made, flush: take }
      })
      useServerInsertedHTML(() => {
        const names = flush()
        if (names.length === 0) return null
        let styles = ''
        for (const name of names) styles += cache.inserted[name]
        return (
          <style
            key={cache.key}
            data-umber={`${cache.key} ${names.join(' ')}`}
            dangerouslySetInnerHTML={{ __html: styles }}
          />
        )
      })
      return <CacheProvider value={cache}>{children}</CacheProvider>
    }
    function Registered({ children }: { children: ReactNode }) {
      const [cache] = useState(() => createCache({ key: 'soroush' }))
      return <StyleRegistry cache={cache}>{children}</StyleRegistry>
    }

    const byHand = renderOnServer(
      <HandWritten>
        <Page />
      </HandWritten>
    )
    const registered = renderOnServer(
      <Registered>
        <Page />
      </Registered>
    )
    expect(byHand.head).toMatch(/^<style data-umber="soroush [^"]+">@layer soroush-theme/)
    expect(registered.html).toBe(byHand.html)
    expect(registered.head).toBe(byHand.head.replace('">', '" data-umber-registry="">'))
    expect(registered.flushes.slice(1)).toEqual(byHand.flushes.slice(1))
  })
})

describe('StyleRegistry with the engine of each style', () => {
  it('writes the theme, the global rules, the animations and the classes of client components, with the nonce of the cache, and hydrates', async () => {
    const { StyleRegistry, createStyle } = await load()
    const { styled, ThemeProvider, keyframes, Global } = createStyle(theme, {
      prefix: 'dp',
      nonce: 'n0',
    })
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const Hero = styled('section', { name: 'Hero' })(({ theme: view }) => ({
      color: view.palette.primary,
      animation: `${fade} 1s`,
    }))
    const Plain = styled('p', { name: 'Plain' })({ margin: 0 })
    const Ident = () => <i id={useId()} />
    const page = (
      <StyleRegistry>
        <ThemeProvider theme={theme}>
          <Global styles={{ body: { margin: 0 } }} />
          <Hero>
            <Ident />
          </Hero>
          <Plain>text</Plain>
        </ThemeProvider>
      </StyleRegistry>
    )
    const { html, head, flushes } = renderOnServer(page)
    expect(html).not.toContain('<style')
    const element = /^<style nonce="n0" data-umber="dp ([^"]+)" data-umber-registry="">/.exec(head)
    expect(element).not.toBeNull()
    const names = (element as RegExpExecArray)[1].split(' ')
    expect(names[0]).toMatch(/^dp-root-/)
    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^dp-global-/),
        expect.stringMatching(/^dp-hero-root-/),
        expect.stringMatching(/^dp-plain-root-/),
      ])
    )
    expect(head).toContain('@keyframes ')
    expect(flushes.slice(1)).toEqual(flushes.slice(1).map(() => ''))

    document.head.innerHTML = head
    const error = vi.spyOn(console, 'error')
    const container = await hydrate(html, page)
    expect(error).not.toHaveBeenCalled()
    expect(container.querySelectorAll('style')).toHaveLength(0)
  })
})

describe('StyleRegistry with the server components build under a nonce', () => {
  // The request being rendered: the slots of `React.cache` are made again for each one.
  let request = 0
  const requestCache: CacheFunction = (make) => {
    let value: ReturnType<typeof make> | undefined
    let madeFor = -1
    return () => {
      if (madeFor !== request) {
        value = make()
        madeFor = request
      }
      return value as ReturnType<typeof make>
    }
  }

  /** The components of the server build in a request of their own, with a nonce source that gives `nonce`. */
  async function makePage(nonce: string) {
    request += 1
    setNonceSource(() => nonce)
    const { bindEngine } = await import('./createStyle.server')
    const engine = createEngine({ palette: { primary: '#0000ff' } }, { prefix: 'nrg' })
    const { styled, ThemeProvider } = bindEngine(engine, requestCache)
    const Box = styled('div', { name: 'Box' })<{ isWide?: boolean }>(
      ({ theme: view }) => ({ color: view.palette.primary }),
      ({ isWide }) => ({ paddingLeft: isWide ? 32 : 8 })
    )
    return { ThemeProvider, Box }
  }

  it('takes every text from the server render, sends nothing in place, hydrates with nothing written, and writes a navigation after its last element', async () => {
    const { StyleRegistry } = await load()
    const first = await makePage('document')
    const page = (
      <StyleRegistry>
        <first.ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <first.Box>one</first.Box>
          <first.Box>two</first.Box>
        </first.ThemeProvider>
      </StyleRegistry>
    )
    const { html, flushes } = renderOnServer(page)
    expect(html).not.toContain('<style')
    expect(flushes[0]).toMatch(
      /^<style nonce="document" data-umber="nrg nrg-root-\w+ nrg-box-root-/
    )
    expect(flushes.slice(1)).toEqual(flushes.slice(1).map(() => ''))

    // The element of a later piece of the stream, at the top of the body.
    document.body.innerHTML = flushes[0]
    const registered = document.body.firstElementChild as HTMLStyleElement
    const error = vi.spyOn(console, 'error')
    request += 1
    const container = await hydrate(html, page)
    expect(error).not.toHaveBeenCalled()
    expect(container.querySelectorAll('style')).toHaveLength(0)
    // The engine of the test writes into a sheet of its own in this document (`data-style`): not counted.
    expect(document.querySelectorAll('style:not([data-style])')).toHaveLength(1)

    const next = await makePage('navigation')
    mount(
      <StyleRegistry>
        <next.Box isWide>three</next.Box>
      </StyleRegistry>
    )
    const written = registered.nextElementSibling as HTMLStyleElement
    expect(written.dataset.precedence).toBe('nrg')
    expect(written.getAttribute('nonce')).toBe('document')
    expect(written.textContent).toContain('padding-left:32px')
    expect(document.querySelectorAll('style:not([data-style])')).toHaveLength(2)
  })
})
