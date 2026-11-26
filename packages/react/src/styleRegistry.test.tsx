import createCache from '@umber-style/cache'
import { createMemorySheet } from '@umber-style/core'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createRegistryStore,
  getRegistryContext,
  markRegistryRendered,
  registerTexts,
  renderRegistered,
  takeRegistered,
  useStyleRegistry,
  watchCache,
} from './styleRegistry'

const a = { href: 'rg-a', text: '.rg-a{color:red;}' }
const b = { href: 'rg-b', text: '.rg-b{color:blue;}' }

/** `run`, where there is no document, as a server render is. */
function onServer<R>(run: () => R): R {
  vi.stubGlobal('document', undefined)
  try {
    return run()
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('registerTexts', () => {
  it('holds nothing in the browser, where nothing would write it', () => {
    const store = createRegistryStore()
    registerTexts(store, 'rg', [a], 'n1')
    expect(store).toEqual({ seen: new Set(), pending: [] })
  })

  it('holds each text of the request once, with its prefix, and keeps the first nonce as the request nonce', () => {
    const store = createRegistryStore()
    onServer(() => {
      registerTexts(store, 'rg', [a], undefined)
      registerTexts(store, 'rg', [a, b], 'n1')
      registerTexts(store, 'other', [a], 'n2')
    })
    expect(store.nonce).toBe('n1')
    expect(store.pending).toEqual([
      { prefix: 'rg', ...a },
      { prefix: 'rg', ...b, nonce: 'n1' },
      { prefix: 'other', ...a, nonce: 'n2' },
    ])
  })
})

describe('takeRegistered', () => {
  it('gives one group for each prefix and nonce, in order, and a text with no nonce the nonce of the request', () => {
    const store = createRegistryStore()
    onServer(() => {
      registerTexts(store, 'rg', [a], undefined)
      registerTexts(store, 'other', [a], 'n2')
      registerTexts(store, 'rg', [b], 'n1')
    })
    expect(takeRegistered(store)).toEqual([
      { prefix: 'rg', nonce: 'n2', hrefs: ['rg-a'], text: a.text },
      { prefix: 'other', nonce: 'n2', hrefs: ['rg-a'], text: a.text },
      { prefix: 'rg', nonce: 'n1', hrefs: ['rg-b'], text: b.text },
    ])
    expect(takeRegistered(store)).toEqual([])
  })

  it('gives no nonce when no text of the request came with one', () => {
    const store = createRegistryStore()
    onServer(() => registerTexts(store, 'rg', [a], undefined))
    expect(takeRegistered(store)).toEqual([{ prefix: 'rg', hrefs: ['rg-a'], text: a.text }])
  })
})

describe('renderRegistered', () => {
  it('is the style elements of what is new, then nothing', () => {
    const store = createRegistryStore()
    onServer(() =>
      registerTexts(store, 'rg', [a, { href: 'rg-c', text: '.c::after{content:"</style>"}' }], 'n1')
    )
    expect(renderToStaticMarkup(<>{renderRegistered(store)}</>)).toBe(
      String.raw`<style nonce="n1" data-umber="rg rg-a rg-c" data-umber-registry="">.rg-a{color:red;}.c::after{content:"</\73 tyle>"}</style>`
    )
    expect(renderRegistered(store)).toBeNull()
  })
})

describe('useStyleRegistry', () => {
  it('reads the context once a registry has rendered', () => {
    const Probe = () => <>{String(useStyleRegistry()?.pending.length)}</>
    const store = createRegistryStore()
    const { Provider } = getRegistryContext()
    expect(
      renderToStaticMarkup(
        <Provider value={store}>
          <Probe />
        </Provider>
      )
    ).toBe('undefined')
    markRegistryRendered()
    expect(
      renderToStaticMarkup(
        <Provider value={store}>
          <Probe />
        </Provider>
      )
    ).toBe('0')
    expect(renderToStaticMarkup(<Probe />)).toBe('undefined')
  })
})

describe('watchCache', () => {
  it('registers each new group of rules of the cache with its key and nonce, wraps once, and calls the insert it wraps', () => {
    const cache = createCache({
      key: 'wc',
      nonce: 'n1',
      hasLayers: false,
      hasDevChecks: false,
      sheet: createMemorySheet(),
    })
    const seen: string[] = []
    const insert = cache.insert
    cache.insert = (...args) => {
      seen.push(args[1].name)
      insert(...args)
    }
    const first = createRegistryStore()
    const second = createRegistryStore()
    watchCache(cache, first)
    const wrapped = cache.insert
    watchCache(cache, second)
    expect(cache.insert).toBe(wrapped)
    const name = onServer(() => {
      const made = cache.css({ color: 'red' })
      cache.css({ color: 'red' })
      return made
    })
    expect(seen).toEqual([name])
    expect(first.pending).toEqual([])
    expect(second.pending).toEqual([
      { prefix: 'wc', href: name, text: `.${name}{color:red;}`, nonce: 'n1' },
    ])
    // A group the cache wrote before is not registered again.
    onServer(() => cache.insert('', { name, styles: 'x' }, cache.sheet, true))
    expect(second.pending).toHaveLength(1)
  })
})
