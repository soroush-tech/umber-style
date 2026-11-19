import { createCache, createMemorySheet } from './cache'
import { createStyleTag } from './extractStyles'

afterEach(() => {
  document.head.innerHTML = ''
})

describe('createStyleTag', () => {
  it('writes the css of a cache into one style element, stamped with its options', () => {
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    const name = cache.css({ color: 'red' })
    cache.insertOnce('base', ['body{margin:0;}'])
    expect(createStyleTag(cache)).toBe(
      `<style data-style="u" data-options="${cache.fingerprint}">.${name}{color:red;}body{margin:0;}</style>`
    )
  })

  it('writes an empty element for an empty cache', () => {
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    expect(createStyleTag(cache)).toBe(
      `<style data-style="u" data-options="${cache.fingerprint}"></style>`
    )
  })

  it('makes a cache in the browser skip what the markup holds', () => {
    const server = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    const name = server.css({ color: 'red' })
    document.head.innerHTML = createStyleTag(server)

    const sheet = createMemorySheet()
    const client = createCache({ hasLayers: false, prefix: 'u', sheet })
    expect(client.css({ color: 'red' })).toBe(name)
    expect(sheet.rules).toEqual([])
    client.css({ color: 'blue' })
    expect(sheet.rules).toHaveLength(1)
  })
})
