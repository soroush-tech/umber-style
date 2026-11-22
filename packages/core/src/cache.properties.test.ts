import { createCache, createDomSheet, createMemorySheet } from './cache'
import { createStyleTag } from './extractStyles'
import { createThemeClass } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
})

const colorRule = '@property --u-a{syntax:"<color>";inherits:true;initial-value:#fff;}'
const lengthRule = '@property --u-b{syntax:"<length>";inherits:true;initial-value:4px;}'
const rules = { '--u-a': colorRule, '--u-b': lengthRule }

function setup(options: { hasLayers?: boolean; hasPruning?: boolean } = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 'u', sheet, ...options })
  return { cache, sheet }
}

describe('registered properties in a cache', () => {
  it('writes the rule of a variable when a rule first uses it, once, and not before', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    cache.registerProperties(rules)
    expect(sheet.rules).toEqual([])
    cache.css({ color: 'var(--u-a)' })
    expect(sheet.rules.filter((rule) => rule.startsWith('@property'))).toEqual([colorRule])
    cache.css({ background: 'var(--u-a)' })
    cache.markUsed(['--u-a'])
    expect(sheet.rules.filter((rule) => rule.startsWith('@property'))).toEqual([colorRule])
  })

  it('writes the rule of a variable that was used before it was registered', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    cache.markUsed(['--u-b'])
    cache.registerProperties(rules)
    expect(sheet.rules).toEqual([lengthRule])
  })

  it('writes the rule of a variable that a marked variable refers to, and one that a theme refers to', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    cache.registerProperties(rules)
    createThemeClass(cache, { '--u-x': 'var(--u-b)', '--u-a': '#fff' })
    cache.markUsed(['--u-x'])
    expect(sheet.rules).toContain(lengthRule)
    expect(sheet.rules).not.toContain(colorRule)
  })

  it('writes every rule at once when there is no pruning', () => {
    const { cache, sheet } = setup({ hasLayers: false, hasPruning: false })
    cache.registerProperties(rules)
    expect(sheet.rules).toEqual([colorRule, lengthRule])
  })

  it('writes the rule outside every layer, after the statement of the layer order', () => {
    const { cache, sheet } = setup()
    cache.registerProperties(rules)
    cache.css({ color: 'var(--u-a)' })
    expect(sheet.rules[0]).toBe(cache.layerOrder)
    expect(sheet.rules).toContain(colorRule)
    expect(
      sheet.rules.some((rule) => rule.startsWith('@layer u-') && rule.includes('@property'))
    ).toBe(false)
    expect(sheet.rules.filter((rule) => rule.includes('@property'))).toHaveLength(1)
  })

  it('has insertOnce write rules outside every layer when it is given none', () => {
    const { cache, sheet } = setup()
    expect(cache.insertOnce('plain', ['@property --u-c{syntax:"*";inherits:true;}'])).toBe(true)
    expect(cache.insertOnce('plain', ['@property --u-c{syntax:"*";inherits:true;}'])).toBe(false)
    expect(cache.insertOnce('layered', ['.x{color:red;}'], 'components')).toBe(true)
    expect(sheet.rules).toEqual([
      cache.layerOrder,
      '@property --u-c{syntax:"*";inherits:true;}',
      '@layer u-components{.x{color:red;}}',
    ])
  })

  it('gives a rule by the variable name through getRules, once it is written', () => {
    const { cache } = setup({ hasLayers: false })
    cache.registerProperties(rules)
    expect(cache.getRules('--u-a')).toEqual([])
    cache.markUsed(['--u-a'])
    expect(cache.getRules('--u-a')).toEqual([colorRule])
  })

  it('writes a changed rule after the old one when the registrations are replaced, and a same rule never', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    cache.registerProperties(rules)
    cache.markUsed(['--u-a'])
    cache.registerProperties(rules)
    expect(sheet.rules).toEqual([colorRule])
    const changed = '@property --u-a{syntax:"<color>";inherits:true;initial-value:#000;}'
    cache.registerProperties({ '--u-a': changed })
    expect(sheet.rules).toEqual([colorRule, changed])
    expect(cache.getRules('--u-a')).toEqual([changed])
    cache.registerProperties({})
    expect(sheet.rules).toEqual([colorRule, changed])
  })

  it('is in the extracted css and in its ids', () => {
    const { cache } = setup({ hasLayers: false })
    cache.registerProperties(rules)
    cache.css({ color: 'var(--u-a)' })
    const { css, ids } = cache.extract()
    expect(css).toContain(colorRule)
    expect(css).not.toContain(lengthRule)
    expect(ids.some((id) => id.startsWith('@property:--u-a:'))).toBe(true)
    expect(ids).toContain('--u-a')
    expect(createStyleTag(cache)).toContain(colorRule)
  })
})

describe('getFullRules with registered properties', () => {
  it('puts the rules of the registered variables of a theme class in front of its rule, used or not', () => {
    const { cache } = setup({ hasLayers: false })
    cache.registerProperties(rules)
    const light = createThemeClass(cache, { '--u-a': '#fff', '--u-z': '1' })
    const other = createThemeClass(cache, { '--u-z': '2' })
    expect(cache.getFullRules(light)).toEqual([colorRule, `.${light}{--u-a:#fff;--u-z:1;}`])
    expect(cache.getFullRules(other)).toEqual([`.${other}{--u-z:2;}`])
    expect(cache.getRules(light)).toEqual([])
  })

  it('does the same without pruning, and for a class in a layer', () => {
    const { cache } = setup({ hasPruning: false })
    cache.registerProperties(rules)
    const light = createThemeClass(cache, { '--u-b': '8px' })
    expect(cache.getFullRules(light)).toEqual([lengthRule, `@layer u-theme{.${light}{--u-b:8px;}}`])
  })

  it('is just the rules of an id that is not a theme class', () => {
    const { cache } = setup({ hasLayers: false })
    cache.registerProperties(rules)
    cache.insertOnce('x', ['.x{color:red;}'])
    expect(cache.getFullRules('x')).toEqual(['.x{color:red;}'])
    expect(cache.getFullRules('missing')).toEqual([])
  })
})

describe('registered properties and a server render', () => {
  it.each([true, false])(
    'are not written again by a cache that hydrates the style element, speedy %s',
    (speedy) => {
      for (const hasPruning of [true, false]) {
        document.head.innerHTML = ''
        const server = createCache({ prefix: 'u', sheet: createMemorySheet(), hasPruning })
        server.registerProperties(rules)
        server.css({ color: 'var(--u-a)', margin: 'var(--u-b)' })
        document.head.innerHTML = createStyleTag(server)
        const element = document.querySelector('style[data-style="u"]') as HTMLStyleElement
        const before = element.sheet?.cssRules.length

        const sheet = createDomSheet('u', undefined, { speedy })
        const client = createCache({ prefix: 'u', sheet, hasPruning })
        client.registerProperties(rules)
        client.css({ color: 'var(--u-a)', margin: 'var(--u-b)' })
        client.markUsed(['--u-a', '--u-b'])
        expect(before).toBeGreaterThan(2)
        expect(element.sheet?.cssRules.length).toBe(before)
        expect(sheet.rules).toEqual([])
      }
    }
  )

  it.each([true, false])(
    'are written by a cache that hydrates a render that did not use the variable, speedy %s',
    (speedy) => {
      const server = createCache({ prefix: 'u', sheet: createMemorySheet() })
      server.registerProperties(rules)
      server.css({ color: 'var(--u-a)' })
      document.head.innerHTML = createStyleTag(server)
      const client = createCache({
        prefix: 'u',
        sheet: createDomSheet('u', undefined, { speedy }),
      })
      client.registerProperties(rules)
      const before = readPageRules('u').length
      client.css({ margin: 'var(--u-b)' })
      const texts = readPageRules('u')
      expect(texts.filter((text) => text.startsWith('@property'))).toHaveLength(2)
      expect(texts.length).toBeGreaterThan(before)
    }
  )
})

describe('what a DOM sheet does with an @property rule', () => {
  it.each([true, false])('takes it as a property rule, speedy %s', (speedy) => {
    const sheet = createDomSheet('p', undefined, { speedy })
    sheet.insert(colorRule)
    const element = document.querySelector('style[data-style="p"]') as HTMLStyleElement
    expect(element.sheet?.cssRules).toHaveLength(1)
    expect(element.sheet?.cssRules[0].cssText).toContain('@property --u-a')
    expect(sheet.rules).toEqual([colorRule])
  })

  it('skips one that the browser rejects, written by insertRule', () => {
    const sheet = createDomSheet('p', undefined, { speedy: true })
    sheet.insert('@property')
    expect(sheet.rules).toEqual([])
  })

  it('keeps one that the browser rejects in its text, which the browser does not take, written by text', () => {
    const sheet = createDomSheet('p', undefined, { speedy: false })
    sheet.insert(colorRule)
    sheet.insert('@property')
    const element = document.querySelector('style[data-style="p"]') as HTMLStyleElement
    expect(sheet.rules).toEqual([colorRule, '@property'])
    expect(element.sheet?.cssRules).toHaveLength(1)
  })
})

/** The text of every rule of the style elements of `key` that the browser took, in document order. */
function readPageRules(key: string): string[] {
  return [...document.querySelectorAll<HTMLStyleElement>(`style[data-style="${key}"]`)].flatMap(
    (element) => [...(element.sheet?.cssRules ?? [])].map((rule) => rule.cssText)
  )
}
