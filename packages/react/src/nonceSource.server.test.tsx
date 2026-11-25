import { createCache, createEngine, createMemorySheet, setNonceSource } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { createNonceReader, type CacheFunction } from './serverContext'
import { playScopes } from './vitest.providerScope'
import { findAll, resolveTree } from './vitest.resolveTree'

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
  /** The nonce of each style element of a render of the page, as the next request. */
  const renderNonces = async () => {
    request += 1
    const styles = findAll(playScopes(await resolveTree(page)), 'style')
    expect(styles.length).toBeGreaterThanOrEqual(6)
    return styles.map((element) => element.props.nonce)
  }
  return { renderNonces }
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
