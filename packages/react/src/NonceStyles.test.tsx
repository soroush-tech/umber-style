import { act, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createEngine, setNonceSource } from '@umber-style/core'
import type * as Module from './NonceStyles'
import type { CacheFunction } from './serverContext'

// `NonceStyles` in the client build, with a DOM. The module keeps the nonce of the document and the
// elements it wrote for the life of the page: each test loads it again, as a new page would.

const PREFIX = 'nst'
const a = { href: 'nst-a', text: '.nst-a{color:red;}' }
const b = { href: 'nst-b', text: '.nst-b{color:blue;}' }
const fade = { href: 'fade-1', text: '@keyframes fade-1{0%{opacity:0;}}' }

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

/** The module as a new page loads it: nothing recorded, nothing written. */
async function load(): Promise<typeof Module> {
  vi.resetModules()
  return import('./NonceStyles')
}

/**
 * The first HTML of `node` in a container of the body, then its hydration. `beforeRender` runs before
 * each of the two renders: the server and the browser render the same payload, which a component of the
 * server build makes again in each render here.
 */
async function hydrate(
  node: ReactNode,
  beforeRender: () => void = () => undefined
): Promise<HTMLElement> {
  const container = document.createElement('div')
  beforeRender()
  container.innerHTML = renderToString(node)
  document.body.append(container)
  beforeRender()
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

/** The elements written into the head for `prefix`: their nonce, `href` and text. */
const readHead = (prefix = PREFIX) =>
  [...document.head.querySelectorAll<HTMLStyleElement>('style[data-precedence]')]
    .filter(({ dataset }) => dataset.precedence === prefix)
    .map((element) => ({
      nonce: element.getAttribute('nonce'),
      href: element.dataset.href,
      text: element.textContent,
    }))

/** Makes every style element that the page makes from now on refused by the policy: it has no sheet. */
function refuseNewStyles(): void {
  const create = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, options) => {
    const element = create(tag, options)
    if (tag === 'style') Object.defineProperty(element, 'sheet', { value: null })
    return element
  })
}

/** A style element of the page, in the head, that the policy refused when `isRefused`. */
function addHeadStyle(attributes: Record<string, string>, text: string, isRefused = false) {
  const element = document.createElement('style')
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.textContent = text
  document.head.append(element)
  if (isRefused) Object.defineProperty(element, 'sheet', { value: null })
  return element
}

describe('readDocumentNonce', () => {
  it('is the nonce of a style element the policy let in, else of a script, else none', async () => {
    const { readDocumentNonce } = await load()
    expect(readDocumentNonce(document)).toBeUndefined()
    const script = document.createElement('script')
    script.setAttribute('nonce', 'from-script')
    document.head.append(script)
    expect(readDocumentNonce(document)).toBe('from-script')
    addHeadStyle({ nonce: 'refused' }, 'p{}', true)
    expect(readDocumentNonce(document)).toBe('from-script')
    addHeadStyle({ nonce: 'applied' }, 'p{}')
    expect(readDocumentNonce(document)).toBe('applied')
  })

  it('is the nonce recorded at hydration, whatever the page holds', async () => {
    const { NonceStyles, readDocumentNonce } = await load()
    addHeadStyle({ nonce: 'applied' }, 'p{}')
    await hydrate(<NonceStyles prefix={PREFIX} texts={[a]} nonce="document" />)
    expect(readDocumentNonce(document)).toBe('document')
  })
})

describe('NonceStyles in the first HTML', () => {
  it('is a style element in place with the nonce, which names the prefix and each href it shows', async () => {
    const { NonceStyles } = await load()
    const html = renderToString(<NonceStyles prefix={PREFIX} texts={[fade, a]} nonce="n1" />)
    expect(html).toBe(
      `<style nonce="n1" data-umber-inline="nst fade-1 nst-a">${fade.text}${a.text}</style>`
    )
  })

  it('shows in place only the texts that no element before it showed in the request', async () => {
    const { NonceStyles } = await load()
    const html = renderToString(
      <NonceStyles prefix={PREFIX} texts={[a, b]} shown={['nst-b']} nonce="n1" />
    )
    expect(html).toBe(`<style nonce="n1" data-umber-inline="nst nst-b">${b.text}</style>`)
    expect(renderToString(<NonceStyles prefix={PREFIX} texts={[a]} shown={[]} nonce="n1" />)).toBe(
      ''
    )
  })

  it('hands every text to the head at hydration, with the nonce of the document, then leaves its place', async () => {
    const { NonceStyles } = await load()
    const error = vi.spyOn(console, 'error')
    const container = await hydrate(
      <>
        <NonceStyles prefix={PREFIX} texts={[fade, a]} nonce="n1" />
        <p className="nst-a">a</p>
        <NonceStyles prefix={PREFIX} texts={[a, b]} shown={['nst-b']} nonce="n1" />
      </>
    )
    expect(error).not.toHaveBeenCalled()
    expect(readHead()).toEqual([
      { nonce: 'n1', href: 'fade-1', text: fade.text },
      { nonce: 'n1', href: 'nst-a', text: a.text },
      { nonce: 'n1', href: 'nst-b', text: b.text },
    ])
    expect(container.innerHTML).toBe('<p class="nst-a">a</p>')
  })

  it('stays in place, and writes nothing, when no nonce of the document is found', async () => {
    const { NonceStyles } = await load()
    const container = await hydrate(<NonceStyles prefix={PREFIX} texts={[a]} />)
    expect(readHead()).toEqual([])
    expect(container.innerHTML).toBe(`<style data-umber-inline="nst nst-a">${a.text}</style>`)
  })

  it('stays in place when the policy refused what it wrote, and does not write it again', async () => {
    const { NonceStyles } = await load()
    refuseNewStyles()
    const container = await hydrate(
      <>
        <NonceStyles prefix={PREFIX} texts={[a]} nonce="wrong" />
        <NonceStyles prefix={PREFIX} texts={[a]} nonce="wrong" />
      </>
    )
    expect(readHead()).toEqual([{ nonce: 'wrong', href: 'nst-a', text: a.text }])
    expect(container.querySelectorAll('style[data-umber-inline]')).toHaveLength(2)
  })
})

describe('NonceStyles mounted after the first HTML', () => {
  it('renders nothing and writes its texts into the head with the document nonce, not its own', async () => {
    const { NonceStyles } = await load()
    await hydrate(<NonceStyles prefix={PREFIX} texts={[a]} nonce="document" />)
    const container = mount(<NonceStyles prefix={PREFIX} texts={[a, b]} nonce="navigation" />)
    expect(container.innerHTML).toBe('')
    expect(readHead()).toEqual([
      { nonce: 'document', href: 'nst-a', text: a.text },
      { nonce: 'document', href: 'nst-b', text: b.text },
    ])
  })

  it('takes the nonce of the page when no element was hydrated, and writes nothing when there is none', async () => {
    const { NonceStyles } = await load()
    const before = mount(<NonceStyles prefix={PREFIX} texts={[a]} nonce="navigation" />)
    expect(before.innerHTML).toBe('')
    expect(readHead()).toEqual([])
    const script = document.createElement('script')
    script.setAttribute('nonce', 'page')
    document.head.append(script)
    mount(<NonceStyles prefix={PREFIX} texts={[b]} nonce="navigation" />)
    expect(readHead()).toEqual([{ nonce: 'page', href: 'nst-b', text: b.text }])
  })

  it('writes nothing for a class the head holds already, its own or one React let in', async () => {
    const { NonceStyles } = await load()
    await hydrate(<NonceStyles prefix={PREFIX} texts={[a]} nonce="document" />)
    addHeadStyle({ 'data-precedence': PREFIX, 'data-href': 'nst-x nst-b' }, b.text)
    mount(<NonceStyles prefix={PREFIX} texts={[a, b]} nonce="navigation" />)
    mount(<NonceStyles prefix={PREFIX} texts={[a]} nonce="later" />)
    expect(readHead().map(({ href }) => href)).toEqual(['nst-a', 'nst-x nst-b'])
  })

  it('writes after the last element of its prefix, in the order of first use', async () => {
    const { NonceStyles } = await load()
    addHeadStyle({ nonce: 'document' }, 'p{}')
    addHeadStyle({ 'data-precedence': PREFIX, 'data-href': 'nst-first' }, '.nst-first{}')
    const other = addHeadStyle({ 'data-precedence': 'other', 'data-href': 'other-a' }, '.o{}')
    mount(<NonceStyles prefix={PREFIX} texts={[a, b]} nonce="navigation" />)
    expect(readHead().map(({ href }) => href)).toEqual(['nst-first', 'nst-a', 'nst-b'])
    expect(document.head.lastElementChild).toBe(other)
  })
})

describe('what the page holds is never trusted', () => {
  it('takes no text from an element of the page, and lets no refused element stand for a class', async () => {
    const { NonceStyles } = await load()
    addHeadStyle({ nonce: 'document' }, 'p{}')
    // Injected with no nonce: the policy refused both, so neither has a sheet.
    addHeadStyle({ 'data-precedence': PREFIX, 'data-href': 'nst-a' }, '.nst-a{color:green;}', true)
    document.body.insertAdjacentHTML(
      'beforeend',
      `<style data-umber-inline="nst nst-b">.nst-b{color:green;}</style>`
    )
    mount(<NonceStyles prefix={PREFIX} texts={[a, b]} nonce="navigation" />)
    const written = readHead().filter(({ nonce }) => nonce === 'document')
    expect(written).toEqual([
      { nonce: 'document', href: 'nst-a', text: a.text },
      { nonce: 'document', href: 'nst-b', text: b.text },
    ])
  })
})

describe('the server build under a nonce source, rendered by the client build of React', () => {
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
  const startRequest = () => {
    request += 1
  }

  /** A page of the server build, rendered in a request of its own, with a nonce source that gives `nonce`. */
  async function makePage(nonce: string) {
    setNonceSource(() => nonce)
    const { bindEngine } = await import('./createStyle.server')
    const engine = createEngine({ palette: { primary: '#0000ff' } }, { prefix: 'nsp' })
    const { styled, ThemeProvider } = bindEngine(engine, requestCache)
    const Box = styled('div', { name: 'Box' })<{ isWide?: boolean }>(
      ({ theme }) => ({ color: theme.palette.primary }),
      ({ isWide }) => ({ paddingLeft: isWide ? 32 : 8 })
    )
    return { ThemeProvider, Box }
  }

  it('hydrates the first HTML, then a navigation writes only the classes the head does not hold, with the document nonce', async () => {
    await load()
    const first = await makePage('document')
    const error = vi.spyOn(console, 'error')
    const container = await hydrate(
      <first.ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
        <first.Box>one</first.Box>
        <first.Box>two</first.Box>
      </first.ThemeProvider>,
      startRequest
    )
    expect(error).not.toHaveBeenCalled()
    expect(container.querySelectorAll('style')).toHaveLength(0)
    const hydrated = readHead('nsp')
    expect(hydrated.length).toBeGreaterThan(1)
    expect(hydrated.map(({ nonce }) => nonce)).toEqual(hydrated.map(() => 'document'))

    const next = await makePage('navigation')
    startRequest()
    const page = mount(
      <next.ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
        <next.Box>three</next.Box>
        <next.Box isWide>four</next.Box>
      </next.ThemeProvider>
    )
    expect(page.querySelectorAll('style')).toHaveLength(0)
    const after = readHead('nsp')
    expect(after.slice(0, hydrated.length)).toEqual(hydrated)
    expect(after.length).toBe(hydrated.length + 1)
    expect(after.map(({ nonce }) => nonce)).toEqual(after.map(() => 'document'))
    expect(after.at(-1)?.text).toContain('padding-left:32px')
  })
})
