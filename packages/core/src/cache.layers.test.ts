import { createCache, createDomSheet, createMemorySheet, RULE_LAYERS } from './cache'
import { createStyleTag } from './extractStyles'
import { createThemeClass } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
})

const ORDER = '@layer u-theme,u-global,u-components,u-overrides;'

function setup(prefix = 'u') {
  const sheet = createMemorySheet()
  return { sheet, cache: createCache({ hasPruning: false, prefix, sheet }) }
}

describe('the layers of a cache', () => {
  it('names four layers after the prefix, in order, lowest priority first', () => {
    expect(RULE_LAYERS).toEqual(['theme', 'global', 'components', 'overrides'])
    const { cache } = setup()
    expect(cache.hasLayers).toBe(true)
    expect(cache.layerOrder).toBe(ORDER)
  })

  it('has no layers and no order statement with hasLayers: false', () => {
    const cache = createCache({ hasLayers: false, sheet: createMemorySheet() })
    expect(cache.hasLayers).toBe(false)
    expect(cache.layerOrder).toBe('')
  })

  it('writes nothing until a rule is inserted, then the order statement first, once', () => {
    const { cache, sheet } = setup()
    expect(sheet.rules).toEqual([])
    cache.insertOnce('empty', [])
    expect(sheet.rules).toEqual([])
    const name = cache.css({ color: 'red' })
    cache.css({ color: 'blue' })
    expect(sheet.rules).toHaveLength(3)
    expect(sheet.rules[0]).toBe(ORDER)
    expect(sheet.rules[1]).toBe(`@layer u-components{.${name}{color:red;}}`)
  })

  it('wraps every rule given to insertOnce in the layer, a media rule as a whole', () => {
    const { cache, sheet } = setup()
    cache.insertOnce('t', ['.a{x:y;}', '@media (min-width:1px){.a{x:z;}}'], 'theme')
    cache.insertOnce('g', ['body{margin:0;}'], 'global')
    cache.insertOnce('raw', ['p{x:y;}'])
    expect(sheet.rules).toEqual([
      ORDER,
      '@layer u-theme{.a{x:y;}}',
      '@layer u-theme{@media (min-width:1px){.a{x:z;}}}',
      '@layer u-global{body{margin:0;}}',
      'p{x:y;}',
    ])
    expect(cache.getRules('t')).toEqual([
      '@layer u-theme{.a{x:y;}}',
      '@layer u-theme{@media (min-width:1px){.a{x:z;}}}',
    ])
    expect(cache.insertOnce('t', ['.b{}'], 'theme')).toBe(false)
  })

  it('puts css in components and cssIn in the layer it is given', () => {
    const { cache, sheet } = setup()
    const component = cache.css({ color: 'red', '&:hover': { color: 'blue' } })
    const override = cache.cssIn('overrides', { color: 'green' })
    expect(sheet.rules).toEqual([
      ORDER,
      `@layer u-components{.${component}{color:red;}}`,
      `@layer u-components{.${component}:hover{color:blue;}}`,
      `@layer u-overrides{.${override}{color:green;}}`,
    ])
  })

  it('makes the same styles two classes in two layers', () => {
    const { cache } = setup()
    const component = cache.css({ color: 'red' })
    const override = cache.cssIn('overrides', { color: 'red' })
    expect(override).not.toBe(component)
    expect(cache.cssIn('overrides', { color: 'red' })).toBe(override)
    expect(cache.getRules(component)[0]).toContain('@layer u-components{')
    expect(cache.getRules(override)[0]).toContain('@layer u-overrides{')
  })

  it('merges a component class into an override class, resolved back to its style', () => {
    const { cache } = setup()
    const component = cache.css({ color: 'red', margin: 1 })
    const override = cache.cssIn('overrides', 'foreign', component, { color: 'blue' })
    const [foreign, made] = override.split(' ')
    expect(foreign).toBe('foreign')
    expect(cache.registered.get(made)).toEqual({ margin: 1, color: 'blue' })
    expect(cache.getRules(made)).toEqual([`@layer u-overrides{.${made}{margin:1px;color:blue;}}`])
    expect(cache.cssIn('overrides', 'foreign')).toBe('foreign')
  })

  it('wraps the rules of a theme class in the theme layer', () => {
    const { cache, sheet } = setup()
    const name = createThemeClass(cache, { '--a': 'b' }, { colorScheme: 'dark' })
    expect(sheet.rules).toEqual([ORDER, `@layer u-theme{.${name}{--a:b;color-scheme:dark;}}`])
  })

  it('extracts the order statement first, with its id', () => {
    const { cache } = setup()
    const name = cache.css({ color: 'red' })
    expect(cache.extract()).toEqual({
      css: `${ORDER}@layer u-components{.${name}{color:red;}}`,
      ids: [name, 'u-layers'],
    })
    expect(createStyleTag(cache)).toBe(
      `<style data-style="u" data-ids="${name} u-layers">${ORDER}@layer u-components{.${name}{color:red;}}</style>`
    )
  })

  it('does not insert anything twice after a server render, the order statement included', () => {
    const server = setup().cache
    const name = server.css({ color: 'red' })
    document.head.innerHTML = createStyleTag(server)

    const sheet = createMemorySheet()
    const client = createCache({ prefix: 'u', sheet })
    expect(client.css({ color: 'red' })).toBe(name)
    expect(sheet.rules).toEqual([])
    client.css({ color: 'blue' })
    expect(sheet.rules).toHaveLength(1)
    expect(sheet.rules[0]).toMatch(/^@layer u-components\{/)
  })

  it('declares the layers once in the DOM sheet, before every other rule', () => {
    const cache = createCache({ prefix: 'u', sheet: createDomSheet('u') })
    cache.css({ color: 'red' })
    cache.cssIn('overrides', { color: 'blue' })
    const rules = [...(document.querySelector('style')?.sheet?.cssRules ?? [])]
    expect(rules).toHaveLength(3)
    expect(rules[0]?.constructor.name).toBe('CSSLayerStatementRule')
    expect(rules.slice(1).every((rule) => rule.constructor.name === 'CSSLayerBlockRule')).toBe(true)
  })
})
