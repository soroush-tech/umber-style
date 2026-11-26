import { createCache, createEngine, createMemorySheet, setNonceSource } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { createNonceReader, type CacheFunction } from './serverContext'
import { playScopes } from './vitest.providerScope'
import { findAll, resolveTree, type ResolvedElement, type ResolvedNode } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff', text: '#111111' } }

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

afterEach(() => {
  setNonceSource(undefined)
  request += 1
})

/** The server build over an engine whose cache has `nonce`, a page of every kind of style element, and its nonces. */
function setup(nonce?: string) {
  const cache = createCache({ prefix: 'ns', sheet: createMemorySheet(), nonce })
  const style = bindEngine(createEngine(theme, { prefix: 'ns', cache }), requestCache)
  const { styled, Global, ThemeProvider, keyframes, themeClass } = style
  const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
  const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({
    color: view.palette.primary,
    animation: `${fade} 1s`,
  }))
  const root = themeClass({ palette: { text: '#222222' } })
  const page = (
    <>
      <ThemeProvider theme={{ palette: { text: '#222222' } }} isRoot>
        <i className={root} />
      </ThemeProvider>
      <ThemeProvider theme={{ palette: { text: '#333333' } }}>
        <Global styles={{ body: { margin: 0 } }} />
        <ThemeProvider theme={{ palette: { primary: '#444444' } }} className="nested">
          <Box />
          <Box />
        </ThemeProvider>
      </ThemeProvider>
    </>
  )
  /** The tree of a render of the page, as the next request, with what each provider's browser part renders. */
  const renderPage = async () => {
    request += 1
    return playScopes(await resolveTree(page))
  }
  /**
   * The nonce of each element that carries the styles of a render of the page, as the next request: the
   * `<style href precedence>` elements, or, in a request with a nonce under a source, the `NonceStyles`
   * elements, which then come in their place.
   */
  const renderNonces = async () => {
    const tree = await renderPage()
    const hoisted = findAll(tree, 'style')
    const inline = findNonceStyles(tree)
    expect(hoisted.length === 0 || inline.length === 0, 'one form or the other').toBe(true)
    const carriers = [...hoisted, ...inline]
    // Two providers, a `Global` and two boxes: one `NonceStyles` each, or more hoisted elements.
    expect(carriers.length).toBeGreaterThanOrEqual(5)
    return carriers.map((element) => element.props.nonce)
  }
  return { renderPage, renderNonces }
}

/** Every element of `nodes` (and below) that is the reference to `NonceStyles`, in document order. */
function findNonceStyles(nodes: readonly ResolvedNode[]): ResolvedElement[] {
  return nodes.flatMap((node) => {
    if (typeof node === 'string') return []
    const isNonceStyles = (node.type as unknown as { $$id?: string }).$$id === 'NonceStyles'
    return [...(isNonceStyles ? [node] : []), ...findNonceStyles(node.children)]
  })
}

describe('the nonce of each request in the server components build', () => {
  it('is what the registered source gives, on every style element, the source called once a request', async () => {
    let count = 0
    setNonceSource(() => `request-${++count}`)
    const { renderNonces } = setup('cache-nonce')
    const first = await renderNonces()
    expect(first).toEqual(first.map(() => 'request-1'))
    const second = await renderNonces()
    expect(second).toEqual(second.map(() => 'request-2'))
    expect(count).toBe(2)
  })

  it('awaits a source that answers with a Promise, and then gives the value at once', async () => {
    let count = 0
    setNonceSource(async () => {
      await Promise.resolve()
      return `async-${++count}`
    })
    const { renderNonces } = setup()
    const nonces = await renderNonces()
    expect(nonces).toEqual(nonces.map(() => 'async-1'))
    expect(count).toBe(1)
  })

  it('takes the nonce of the cache where the source gives none, or none is registered', async () => {
    setNonceSource(async () => undefined)
    const fromPromise = await setup('cache-nonce').renderNonces()
    expect(fromPromise).toEqual(fromPromise.map(() => 'cache-nonce'))
    setNonceSource(() => undefined)
    const plain = await setup().renderNonces()
    expect(plain).toEqual(plain.map(() => undefined))
    setNonceSource(undefined)
    const unregistered = await setup('cache-nonce').renderNonces()
    expect(unregistered).toEqual(unregistered.map(() => 'cache-nonce'))
  })

  it('takes the place of the nonce of the cache, which is no longer sent', async () => {
    setNonceSource(() => 'request')
    const nonces = await setup('cache-nonce').renderNonces()
    expect(nonces).not.toContain('cache-nonce')
  })

  it('sends every style of a request with a nonce to NonceStyles, each text shown in place once in the request', async () => {
    setNonceSource(() => 'request')
    const tree = await setup().renderPage()
    expect(findAll(tree, 'style'), 'hoisted elements').toEqual([])
    const inline = findNonceStyles(tree)
    expect(inline.map(({ props }) => props.prefix)).toEqual(inline.map(() => 'ns'))
    // The two boxes, last: the first shows its texts in place, the second needs the same and shows none.
    const [first, second] = inline.slice(-2).map(({ props }) => props)
    expect(first.shown).toBeUndefined()
    expect(second.shown).toEqual([])
    expect(second.texts).toEqual(first.texts)
  })

  it('renders the tree of 0.6.0 where the request has no nonce, under a source or with none registered', async () => {
    const { renderPage } = setup()
    const unregistered = await renderPage()
    setNonceSource(() => undefined)
    const unanswered = await renderPage()
    expect(unanswered).toEqual(unregistered)
    expect(findNonceStyles(unanswered)).toEqual([])
    const hoisted = findAll(unanswered, 'style')
    expect(hoisted.length).toBeGreaterThanOrEqual(6)
    for (const { props } of hoisted)
      expect(props).toMatchObject({ precedence: 'ns', nonce: undefined })
  })

  it('gives every component that asks before the source has answered the one Promise, and the value after', async () => {
    let answer: (value: string) => void = () => undefined
    setNonceSource(() => new Promise<string>((resolve) => (answer = resolve)))
    request += 1
    const readNonce = createNonceReader(() => 'cache', requestCache)
    const first = readNonce()
    expect(readNonce()).toBe(first)
    answer('late')
    expect(await first).toBe('late')
    expect(readNonce()).toBe('late')
  })
})
