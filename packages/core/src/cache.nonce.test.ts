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
    createDomSheet('t')
    expect(findElement('t')?.hasAttribute('nonce')).toBe(false)
    document.head.innerHTML = '<style data-style="own"></style>'
    createDomSheet('own', document.head, { nonce: 'n0nce' })
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
