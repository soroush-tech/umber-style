import { createEngine, setNonceSource } from '@umber-style/core'
import { act, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import type { CacheFunction } from './serverContext'

// One styled component rendered from a server component and from a client component on one page under
// `StyleRegistry` (#91): the server components build (made where there is no document, as on a server)
// and the client build of the same style, one prefix. The hook of Next.js is a stand-in whose callbacks
// are called once the render is done, as the framework calls them on a flush.

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
})

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

const theme = { palette: { primary: '#0000ff' } }
const cardStyle = { paddingLeft: 31, borderTopWidth: 2, borderTopStyle: 'solid' } as const
const navStyle = { paddingLeft: 13, marginTop: 5 } as const

/** Runs `make` where there is no document, as a server does. */
function onServer<R>(make: () => R): R {
  vi.stubGlobal('document', undefined)
  try {
    return make()
  } finally {
    vi.unstubAllGlobals()
  }
}

/** The modules as a new page loads them: the registry, the card and the nav of each build. */
async function load() {
  vi.resetModules()
  const { StyleRegistry } = await import('./next')
  const { createStyle } = await import('./createStyle')
  const { bindEngine } = await import('./createStyle.server')
  const server = onServer(() => bindEngine(createEngine(theme, { prefix: 'shr' }), requestCache))
  /** The client build of the style, made where `make` runs: on the server, or in the browser. */
  const makeClient = () => {
    const { styled } = createStyle(theme, { prefix: 'shr' })
    return {
      Card: styled('section', { name: 'Card' })(cardStyle),
      Nav: styled('section', { name: 'Nav' })(navStyle),
    }
  }
  return {
    StyleRegistry,
    makeClient,
    ServerCard: server.styled('section', { name: 'Card' })(cardStyle),
    ServerNav: server.styled('section', { name: 'Nav' })(navStyle),
  }
}

/** One request as a server renders it: the HTML, and what the flushes of the registry write. */
function renderOnServer(make: () => ReactNode) {
  inserted.callbacks = []
  request += 1
  return onServer(() => {
    const html = renderToString(make())
    const head = inserted.callbacks
      .map((callback) => renderToStaticMarkup(<>{callback() as ReactNode}</>))
      .join('')
    return { html, head }
  })
}

/** The first HTML in the document: the style elements React hoisted and those of the registry in the head, the rest in a container of the body. */
function openFirstHtml({ html, head }: { html: string; head: string }): HTMLElement {
  const hoisted = /^(?:<style[^>]*>[^<]*<\/style>)*/.exec(html)?.[0] ?? ''
  document.head.innerHTML = hoisted + head
  const container = document.createElement('div')
  container.innerHTML = html.slice(hoisted.length)
  document.body.append(container)
  return container
}

/** The class of the element `testId` of `html`. */
const readClass = (html: string, testId: string) =>
  new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0].match(/class="([^"]*)"/)?.[1]

/** How many times the HTML holds the rule of `.name`. */
const countInHtml = (html: string, name: string) => html.split(`.${name}{`).length - 1

/** How many rules of the document's sheets have `.name` as their selector, at any depth. */
function countRules(name: string): number {
  let count = 0
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if ((rule as CSSStyleRule).selectorText === `.${name}`) count++
      if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules)
    }
  }
  for (const sheet of document.styleSheets) visit(sheet.cssRules)
  return count
}

describe('one styled component from a server component and a client component under StyleRegistry', () => {
  it('a request with no nonce: the first HTML holds its rule twice, in the element React hoists and in the registry, and hydration keeps both', async () => {
    const { StyleRegistry, makeClient, ServerCard } = await load()
    const page = (Card: ReturnType<typeof makeClient>['Card']) => (
      <StyleRegistry>
        <ServerCard data-testid="server">server</ServerCard>
        <Card data-testid="client">client</Card>
      </StyleRegistry>
    )
    const first = renderOnServer(() => page(makeClient().Card))
    const name = readClass(first.html, 'server') as string
    expect(readClass(first.html, 'client')).toBe(name)
    expect(first.html).toMatch(new RegExp(`^<style data-precedence="shr" data-href="${name}">`))
    expect(first.head).toMatch(
      new RegExp(`^<style data-umber="shr ${name}" data-umber-registry="">`)
    )
    expect(countInHtml(first.html + first.head, name)).toBe(2)

    const container = openFirstHtml(first)
    const { Card } = makeClient()
    await act(async () => {
      roots.push(hydrateRoot(container, page(Card)))
    })
    expect(countRules(name)).toBe(2)
  })

  it('a request with a nonce: the first HTML holds its rule once, in the registry, and hydration writes it again nowhere', async () => {
    const { StyleRegistry, makeClient, ServerCard } = await load()
    setNonceSource(() => 'document')
    const page = (Card: ReturnType<typeof makeClient>['Card']) => (
      <StyleRegistry>
        <ServerCard data-testid="server">server</ServerCard>
        <Card data-testid="client">client</Card>
      </StyleRegistry>
    )
    const first = renderOnServer(() => page(makeClient().Card))
    const name = readClass(first.html, 'server') as string
    expect(first.html).not.toContain('<style')
    expect(countInHtml(first.head, name)).toBe(1)

    const container = openFirstHtml(first)
    const { Card } = makeClient()
    request += 1
    await act(async () => {
      roots.push(hydrateRoot(container, page(Card)))
    })
    expect(countRules(name)).toBe(1)
  })

  for (const nonce of [undefined, 'document']) {
    it(`${nonce === undefined ? 'a request with no nonce' : 'a request with a nonce'}: after a client-side navigation to a class of both, its rule is in the document once, in the element of the client build's cache`, async () => {
      const { StyleRegistry, makeClient, ServerCard, ServerNav } = await load()
      if (nonce !== undefined) setNonceSource(() => nonce)
      const firstPage = (
        <StyleRegistry>
          <ServerCard data-testid="first">first</ServerCard>
        </StyleRegistry>
      )
      const container = openFirstHtml(renderOnServer(() => firstPage))
      const { Nav } = makeClient()
      request += 1
      await act(async () => {
        roots.push(hydrateRoot(container, firstPage))
      })

      // The page of the navigation: the client component writes the class in its render, and the copy
      // that the server components build sends arrives in the commit, before the elements of the cache.
      request += 1
      const page = document.createElement('div')
      document.body.append(page)
      const root = createRoot(page)
      roots.push(root)
      await act(async () => {
        root.render(
          <StyleRegistry>
            <ServerNav data-testid="server">server</ServerNav>
            <Nav data-testid="client">client</Nav>
          </StyleRegistry>
        )
      })
      const name = (document.querySelector('[data-testid="server"]') as HTMLElement).className
      expect((document.querySelector('[data-testid="client"]') as HTMLElement).className).toBe(name)
      const arrived = document.querySelector(`style[data-href="${name}"]`) as HTMLStyleElement
      expect(arrived.textContent).toContain(`.${name}{`)
      expect(countRules(name)).toBe(1)
      expect(arrived.sheet?.cssRules).toHaveLength(1)
    })
  }
})
