import { createCache, createDomSheet, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { createNonceAttribute, createStyleTag, extractPageStyles } from './extractStyles'

afterEach(() => {
  document.head.innerHTML = ''
})

/** The style element of the engine for `key` in the head. */
const findElement = (key: string) => document.head.querySelector(`style[data-style="${key}"]`)

describe('the nonce of a style element the engine makes', () => {
  it('is set on the element that createDomSheet makes, in either way of writing', () => {
    const text = createDomSheet('t', document.head, { speedy: false, nonce: 'n0nce' })
    text.insert('.a{color:red;}')
    expect(findElement('t')?.getAttribute('nonce')).toBe('n0nce')
    expect(text.rules).toEqual(['.a{color:red;}'])
    const rules = createDomSheet('r', document.head, { speedy: true, nonce: 'n0nce' })
    rules.insert('.a{color:red;}')
    expect(findElement('r')?.getAttribute('nonce')).toBe('n0nce')
    expect(rules.rules).toEqual(['.a{color:red;}'])
  })

  it('is not set without one, and an element that the document had is used as it is', () => {
    createDomSheet('t').insert('.a{color:red;}')
    expect(findElement('t')?.hasAttribute('nonce')).toBe(false)
    document.head.innerHTML = '<style data-style="own"></style>'
    createDomSheet('own', document.head, { nonce: 'n0nce' }).insert('.a{color:red;}')
    expect(document.head.querySelectorAll('style')).toHaveLength(1)
    expect(findElement('own')?.hasAttribute('nonce')).toBe(false)
  })

  it('is set on the element of the cache, which keeps it, and is in no class name and no stamp', () => {
    const cache = createCache({ prefix: 'n', nonce: 'n0nce' })
    const plain = createCache({ prefix: 'p', sheet: createMemorySheet() })
    expect(cache.nonce).toBe('n0nce')
    expect(plain.nonce).toBeUndefined()
    expect(cache.withStyleOptions({ hasValueRepair: true }).nonce).toBe('n0nce')
    const name = cache.css({ color: 'red' })
    expect(findElement('n')?.getAttribute('nonce')).toBe('n0nce')
    expect(name.replace('n-', '')).toBe(plain.css({ color: 'red' }).replace('p-', ''))
    const other = createCache({ prefix: 'n', sheet: createMemorySheet() })
    expect(cache.fingerprint).toBe(other.fingerprint)
  })

  it('is taken by the cache that an engine makes, and warned about with a cache given', () => {
    const engine = createEngine({ space: [0, 4] }, { prefix: 'e', nonce: 'n0nce' })
    expect(engine.cache.nonce).toBe('n0nce')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({ prefix: 'g', sheet: createMemorySheet() })
    expect(createEngine({}, { cache, nonce: 'n0nce', hasDevChecks: true }).cache.nonce).toBe(
      undefined
    )
    expect(warn.mock.calls).toEqual([
      [
        '[g] The engine was given a cache and the options nonce, which the cache decides: they are ignored. Give them to createCache, or leave out the cache.',
      ],
    ])
    warn.mockRestore()
  })
})

describe('the nonce of a style tag', () => {
  it('is written escaped, after the other attributes', () => {
    expect(createNonceAttribute(undefined)).toBe('')
    expect(createNonceAttribute('abc+/=')).toBe(' nonce="abc+/="')
    expect(createNonceAttribute('a"b&c<d>e')).toBe(' nonce="a&quot;b&amp;c&lt;d&gt;e"')
  })

  it('is the nonce of the cache in createStyleTag, or the one given', () => {
    const cache = createCache({
      hasLayers: false,
      prefix: 'u',
      sheet: createMemorySheet(),
      nonce: 'n0nce',
    })
    const name = cache.css({ color: 'red' })
    const start = `<style data-style="u" data-options="${cache.fingerprint}"`
    expect(createStyleTag(cache)).toBe(`${start} nonce="n0nce">.${name}{color:red;}</style>`)
    expect(createStyleTag(cache, { nonce: 'request"1' })).toBe(
      `${start} nonce="request&quot;1">.${name}{color:red;}</style>`
    )
  })

  it('is the nonce given to extractPageStyles for the request, else that of the cache, and never in its CSS', () => {
    const shared = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    const name = shared.css({ color: 'red' })
    const html = `<p class="${name}"></p>`
    const start = `<style data-style="u" data-options="${shared.fingerprint}"`
    const page = extractPageStyles(shared, html, { nonce: 'request1' })
    expect(page.tag).toBe(`${start} nonce="request1">.${name}{color:red;}</style>`)
    expect(page.css).toBe(`.${name}{color:red;}`)
    expect(extractPageStyles(shared, html).tag).toBe(`${start}>.${name}{color:red;}</style>`)
  })

  it('leaves the tag read like any other by a cache in the browser', () => {
    const server = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    const name = server.css({ color: 'red' })
    document.head.innerHTML = createStyleTag(server, { nonce: 'n0nce' })
    const sheet = createMemorySheet()
    const client = createCache({ hasLayers: false, prefix: 'u', sheet, nonce: 'n0nce' })
    expect(client.css({ color: 'red' })).toBe(name)
    expect(sheet.rules).toEqual([])
  })
})

describe('the nonce of the page, for the elements of a cache that has none', () => {
  /** The nonce attribute of every style element of the engine for `key`. */
  const readNonces = (key: string) =>
    [...document.head.querySelectorAll(`style[data-style="${key}"]`)].map((element) =>
      element.getAttribute('nonce')
    )

  /** A script of the head that carries `nonce`, as those of a page sent with a nonce. */
  function addScript(nonce: string): void {
    const script = document.createElement('script')
    script.setAttribute('nonce', nonce)
    document.head.append(script)
  }

  it('is set on every element the cache makes, and the cache keeps no nonce of its own', () => {
    addScript('page')
    const cache = createCache({ prefix: 'pg', hasLayers: false })
    cache.css({ color: 'red' })
    cache.css({ color: 'blue' })
    expect(readNonces('pg').length).toBeGreaterThan(0)
    expect(readNonces('pg')).toEqual(readNonces('pg').map(() => 'page'))
    expect(cache.nonce).toBeUndefined()
  })

  it('is read when the first element is made, not when the cache is, and once', () => {
    const cache = createCache({ prefix: 'lz', hasLayers: false })
    addScript('first')
    cache.css({ color: 'red' })
    document.head.querySelector('script')?.setAttribute('nonce', 'second')
    cache.css({ color: 'blue' })
    expect(readNonces('lz')).toEqual(readNonces('lz').map(() => 'first'))
  })

  it('gives way to the nonce of the cache', () => {
    addScript('page')
    createCache({ prefix: 'own', nonce: 'mine' }).css({ color: 'red' })
    expect(readNonces('own')).toEqual(readNonces('own').map(() => 'mine'))
    expect(readNonces('own').length).toBeGreaterThan(0)
  })

  it('is none on a page with no nonce, and never that of a style element the policy refused', () => {
    createCache({ prefix: 'none' }).css({ color: 'red' })
    expect(readNonces('none')[0]).toBeNull()
    const injected = document.createElement('style')
    injected.setAttribute('nonce', 'injected')
    document.head.append(injected)
    Object.defineProperty(injected, 'sheet', { value: null })
    createCache({ prefix: 'inj' }).css({ color: 'red' })
    expect(readNonces('inj')[0]).toBeNull()
  })

  it('is not read by a sheet that createDomSheet makes, which carries the nonce it is given only', () => {
    addScript('page')
    createDomSheet('dom', document.head).insert('.a{color:red;}')
    expect(readNonces('dom')).toEqual([null])
  })
})

describe('the development warning when the policy refuses the element of a cache', () => {
  /** Makes every style element the page makes from now on refused by the policy: it has no sheet. */
  function refuseNewStyles(): void {
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options) => {
      const element = create(tag, options)
      if (tag === 'style') Object.defineProperty(element, 'sheet', { value: null })
      return element
    })
  }

  /** The messages about the policy that `console.warn` was given while `write` ran. */
  function readPolicyWarnings(write: () => void): unknown[] {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    write()
    const messages = warn.mock.calls.map(([message]) => message)
    warn.mockRestore()
    return messages.filter((message) => String(message).includes('policy'))
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('says once that no nonce was found, when the cache has none and the page has none', () => {
    refuseNewStyles()
    const cache = createCache({ prefix: 'rf', hasDevChecks: true })
    const warnings = readPolicyWarnings(() => {
      cache.css({ color: 'red' })
      cache.css({ color: 'blue' })
    })
    expect(warnings).toEqual([
      '[rf] The policy of this page refused a style element: no nonce was found on the page. Give one with createCache({ nonce }), or with setNonceSource for server components.',
    ])
  })

  it('says once that the nonce given to the cache is not the one of the page', () => {
    refuseNewStyles()
    const cache = createCache({ prefix: 'rg', nonce: 'wrong', hasDevChecks: true })
    const warnings = readPolicyWarnings(() => {
      cache.css({ color: 'red' })
      cache.css({ color: 'blue' })
    })
    expect(warnings).toEqual([
      '[rg] The policy of this page refused a style element with the nonce given to the cache: it is not the nonce of this page. Give the cache the nonce of the request that sent the page.',
    ])
  })

  it('says once that the nonce is the one of a script of the page, which may not be the one of styles', () => {
    const script = document.createElement('script')
    script.setAttribute('nonce', 'scripts')
    document.head.append(script)
    refuseNewStyles()
    const cache = createCache({ prefix: 'rj', hasDevChecks: true })
    const warnings = readPolicyWarnings(() => {
      cache.css({ color: 'red' })
      cache.css({ color: 'blue' })
    })
    expect(warnings).toEqual([
      '[rj] The policy of this page refused a style element with the nonce of a script of the page: the page may give its scripts and its styles different nonces. Give the style nonce with createCache({ nonce }), or with setNonceSource for server components.',
    ])
    script.remove()
  })

  it('says nothing for an element made with the nonce of a style of the page, for one allowed, or without the checks', () => {
    const script = document.createElement('script')
    script.setAttribute('nonce', 'page')
    document.head.append(script)
    expect(
      readPolicyWarnings(() =>
        createCache({ prefix: 'ok', hasDevChecks: true }).css({ color: 'red' })
      )
    ).toEqual([])
    const applied = document.createElement('style')
    applied.setAttribute('nonce', 'styles')
    document.head.append(applied)
    refuseNewStyles()
    expect(
      readPolicyWarnings(() =>
        createCache({ prefix: 'rh', hasDevChecks: true }).css({ color: 'red' })
      )
    ).toEqual([])
    applied.remove()
    expect(
      readPolicyWarnings(() =>
        createCache({ prefix: 'ri', hasDevChecks: false }).css({ color: 'red' })
      )
    ).toEqual([])
    script.remove()
  })

  it('says nothing for an element the page had, which the cache did not make', () => {
    document.head.innerHTML = '<style data-style="had"></style>'
    const element = document.head.querySelector('style') as HTMLStyleElement
    Object.defineProperty(element, 'sheet', { value: null })
    expect(
      readPolicyWarnings(() =>
        createCache({ prefix: 'had', hasDevChecks: true }).css({ color: 'red' })
      )
    ).toEqual([])
  })
})
