import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'

/** The class that `label` gives to a style, in a cache with no layers and the prefix `p`. */
function nameFor(label: string, options: { hasDevChecks?: boolean } = {}): string {
  const cache = createCache({
    prefix: 'p',
    hasLayers: false,
    sheet: createMemorySheet(),
    ...options,
  })
  return cache.css({ label, color: 'red' })
}

/** What the hash of the plain style `{ color: 'red' }` is: the class of a style with no label, without the prefix. */
function readHash(): string {
  const cache = createCache({ prefix: 'p', hasLayers: false, sheet: createMemorySheet() })
  return cache.css({ color: 'red' }).slice('p-'.length)
}

describe('the label in a class name', () => {
  it.each(['card', 'Typography', 'button-root', 'a_b'])(
    'is a label of allowed characters, %j, written as it is',
    (label) => {
      expect(nameFor(label)).toBe(`p-${label}-${readHash()}`)
    }
  )

  it.each([
    ['a space', 'Card Header', 'Card-Header'],
    ['a dot', 'card.title', 'card-title'],
    ['a colon', 'a:b', 'a-b'],
    ['a hash', 'a#b', 'a-b'],
    ['a slash', 'a/b', 'a-b'],
    ['a quote', "a'b", 'a-b'],
    ['a double quote', 'a"b', 'a-b'],
    ['a brace', 'a{b', 'a-b'],
    ['a greater-than sign', 'a>b', 'a-b'],
    ['a comma', 'a,b', 'a-b'],
  ])('writes %s as a hyphen', (_name, label, part) => {
    const name = nameFor(label)
    expect(name).toBe(`p-${part}-${readHash()}`)
    expect(name).not.toMatch(/[\s.:#/'"{>,]/)
  })

  it('writes a hyphen for each character, with no collapsing, at the start and at the end too', () => {
    expect(nameFor('a..b')).toBe(`p-a--b-${readHash()}`)
    expect(nameFor('.a.')).toBe(`p--a--${readHash()}`)
  })

  it('trims white space at the ends first, and a label of only white space adds nothing', () => {
    expect(nameFor('  card  ')).toBe(`p-card-${readHash()}`)
    expect(nameFor('   ')).toBe(`p-${readHash()}`)
  })

  it('writes a hyphen for each non-ASCII code point, and keeps a label of only such characters', () => {
    expect(nameFor('caf\u00e9')).toBe(`p-caf--${readHash()}`)
    expect(nameFor('\u4e2d\u{1f600}')).toBe(`p----${readHash()}`)
  })

  it('writes the joined label of two styles, each character of it', () => {
    const cache = createCache({ prefix: 'p', hasLayers: false, sheet: createMemorySheet() })
    const name = cache.cssWith({ label: 'Card.Title' }, [{ label: 'Link Item', color: 'red' }])
    expect(name).toBe(`p-Card-Title-Link-Item-${readHash()}`)
  })

  it('gives a component named with a dot a class name of one piece', () => {
    const engine = createEngine(
      {},
      { cache: createCache({ prefix: 'e', hasLayers: false, sheet: createMemorySheet() }) }
    )
    const name = engine.createStyler({ name: 'Card.Title' }, [{ color: 'red' }]).getClassName({})
    expect(name).toMatch(/^e-card-title-root-[a-z0-9]+$/)
  })
})

describe('the warning about a label that is written differently in the class name', () => {
  it('names the label and the part once for each distinct label, and writes the class all the same', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({
      prefix: 'lw',
      hasLayers: false,
      sheet: createMemorySheet(),
      hasDevChecks: true,
    })
    expect(cache.css({ label: 'card.title', color: 'red' })).toMatch(/^lw-card-title-[a-z0-9]+$/)
    cache.css({ label: 'card.title', color: 'blue' })
    cache.css({ label: 'Card Header', color: 'red' })
    cache.css({ label: 'plain', color: 'red' })
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[lw] The label "card.title" is "card-title" in the class name: a label may hold a-z, A-Z, 0-9, "_" and "-", so white space at its ends is trimmed and every other character becomes "-".',
      '[lw] The label "Card Header" is "Card-Header" in the class name: a label may hold a-z, A-Z, 0-9, "_" and "-", so white space at its ends is trimmed and every other character becomes "-".',
    ])
    warn.mockRestore()
  })

  it('is silent without the development checks, with the same class', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(nameFor('card.title', { hasDevChecks: false })).toBe(`p-card-title-${readHash()}`)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
