import { createCache, createDomSheet, createMemorySheet, type Sheet } from './cache'
import { createStyleTag } from './extractStyles'
import { createThemeClass } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
})

const light = { '--u-a': '1', '--u-b': '2', '--u-c': 'var(--u-b)' }
const dark = { '--u-a': '10', '--u-d': '4' }

/** A sheet that appends only: what a browser sheet does. */
function createAppendSheet(): Sheet {
  const rules: string[] = []
  return { rules, insert: (rule) => void rules.push(rule) }
}

function setup(options: { hasLayers?: boolean; sheet?: Sheet } = {}) {
  const sheet = options.sheet ?? createMemorySheet()
  const cache = createCache({ hasLayers: false, prefix: 'u', sheet, ...options })
  return { cache, sheet }
}

describe('a pruning cache', () => {
  it('is on by default and writes no rule for a theme class that nothing uses', () => {
    const { cache, sheet } = setup()
    expect(cache.hasPruning).toBe(true)
    const name = createThemeClass(cache, light)
    expect(name).toMatch(/^u-theme-/)
    expect(sheet.rules).toEqual([])
    expect(cache.getRules(name)).toEqual([])
    expect(cache.extract().ids).toEqual([name])
    expect(cache.getFullRules(name)).toEqual([`.${name}{--u-a:1;--u-b:2;--u-c:var(--u-b);}`])
  })

  it('names a theme class from all of its declarations, whatever is used', () => {
    const pruned = setup().cache
    const full = createCache({ hasLayers: false, hasPruning: false, prefix: 'u' })
    pruned.markUsed(['--u-a'])
    expect(createThemeClass(pruned, light)).toBe(createThemeClass(full, light))
  })

  it('writes a used variable into every theme class that has it, in one rule per class', () => {
    const { cache, sheet } = setup()
    const first = createThemeClass(cache, light)
    const second = createThemeClass(cache, dark)
    cache.css({ color: 'var(--u-a)', margin: 'var(--u-d)' })
    expect(cache.getRules(first)).toEqual([`.${first}{--u-a:1;}`])
    expect(cache.getRules(second)).toEqual([`.${second}{--u-a:10;--u-d:4;}`])
    expect(sheet.rules.filter((rule) => rule.startsWith('.u-theme'))).toHaveLength(2)
  })

  it('does not write a variable to a theme class that does not have it', () => {
    const { cache } = setup()
    const first = createThemeClass(cache, light)
    cache.css({ color: 'var(--u-d)' })
    expect(cache.getRules(first)).toEqual([])
    expect(cache.usedVariables.has('--u-d')).toBe(true)
  })

  it('keeps one rule per theme class in a sheet that can replace, in the place of its first one', () => {
    const { cache, sheet } = setup()
    const name = createThemeClass(cache, light)
    cache.css({ color: 'var(--u-a)' })
    cache.css({ margin: 'var(--u-b)' })
    expect(sheet.rules).toHaveLength(3)
    expect(sheet.rules[1]).toBe(`.${name}{--u-a:1;--u-b:2;}`)
    expect(cache.getRules(name)).toEqual([`.${name}{--u-a:1;--u-b:2;}`])
    expect(cache.extract().css).toContain(`.${name}{--u-a:1;--u-b:2;}`)
  })

  it('appends one rule for the variables of one insert in a sheet that cannot replace', () => {
    const { cache, sheet } = setup({ sheet: createAppendSheet() })
    const name = createThemeClass(cache, light)
    cache.css({ color: 'var(--u-a)', margin: 'var(--u-b)' })
    cache.css({ padding: 'var(--u-a)' })
    expect(sheet.rules.filter((rule) => rule.startsWith(`.${name}`))).toEqual([
      `.${name}{--u-a:1;--u-b:2;}`,
    ])
    cache.markUsed(['--u-c'])
    expect(cache.getRules(name)).toEqual([
      `.${name}{--u-a:1;--u-b:2;}`,
      `.${name}{--u-c:var(--u-b);}`,
    ])
  })

  it('writes the used variables when the theme class comes after the rules that use them', () => {
    const { cache } = setup()
    cache.css({ color: 'var(--u-a)' })
    const name = createThemeClass(cache, light)
    expect(cache.getRules(name)).toEqual([`.${name}{--u-a:1;}`])
  })

  it('writes color-scheme with the first rule, or alone when nothing is used', () => {
    const { cache } = setup()
    const alone = createThemeClass(cache, light, { colorScheme: 'dark' })
    expect(cache.getRules(alone)).toEqual([`.${alone}{color-scheme:dark;}`])
    cache.css({ color: 'var(--u-a)' })
    expect(cache.getRules(alone)).toEqual([`.${alone}{--u-a:1;color-scheme:dark;}`])
    expect(cache.getFullRules(alone)).toEqual([
      `.${alone}{--u-a:1;--u-b:2;--u-c:var(--u-b);color-scheme:dark;}`,
    ])
  })

  it('writes color-scheme only once in a sheet that cannot replace', () => {
    const { cache } = setup({ sheet: createAppendSheet() })
    const name = createThemeClass(cache, light, { colorScheme: 'dark' })
    cache.css({ color: 'var(--u-a)' })
    expect(cache.getRules(name)).toEqual([`.${name}{color-scheme:dark;}`, `.${name}{--u-a:1;}`])
  })

  it('declares what the value of a used variable refers to, in every theme class', () => {
    const { cache } = setup()
    const first = createThemeClass(cache, light)
    const second = createThemeClass(cache, { '--u-b': '7', '--u-c': '3' })
    cache.css({ color: 'var(--u-c)' })
    expect(cache.getRules(first)).toEqual([`.${first}{--u-c:var(--u-b);--u-b:2;}`])
    expect(cache.getRules(second)).toEqual([`.${second}{--u-c:3;--u-b:7;}`])
    expect([...cache.usedVariables]).toEqual(['--u-c', '--u-b'])
  })

  it('declares what the value of a variable refers to when the theme class comes late', () => {
    const { cache } = setup()
    cache.css({ color: 'var(--u-c)' })
    const name = createThemeClass(cache, light)
    expect(cache.getRules(name)).toEqual([`.${name}{--u-b:2;--u-c:var(--u-b);}`])
  })

  it('follows a chain of references and stops at a loop', () => {
    const { cache } = setup()
    const name = createThemeClass(cache, { '--u-a': 'var(--u-b)', '--u-b': 'var(--u-a, 1)' })
    cache.markUsed(['--u-a'])
    expect(cache.getRules(name)).toEqual([`.${name}{--u-a:var(--u-b);--u-b:var(--u-a, 1);}`])
  })

  it('marks a name once, and an empty list does nothing', () => {
    const { cache, sheet } = setup()
    createThemeClass(cache, light)
    cache.markUsed([])
    cache.markUsed(['--u-a'])
    const count = sheet.rules.length
    cache.markUsed(['--u-a'])
    expect(sheet.rules).toHaveLength(count)
  })

  it('makes the same theme class once', () => {
    const { cache, sheet } = setup()
    const name = createThemeClass(cache, light)
    cache.css({ color: 'var(--u-a)' })
    expect(createThemeClass(cache, light)).toBe(name)
    expect(sheet.rules).toHaveLength(2)
  })

  it('wraps the rules in the theme layer, after the order statement', () => {
    const { cache, sheet } = setup({ hasLayers: true })
    const name = createThemeClass(cache, light, { colorScheme: 'light' })
    cache.css({ color: 'var(--u-a)' })
    expect(sheet.rules[0]).toBe('@layer u-theme,u-global,u-components,u-overrides;')
    expect(sheet.rules).toContain(`@layer u-theme{.${name}{--u-a:1;color-scheme:light;}}`)
    expect(sheet.rules.filter((rule) => rule.includes('u-theme,'))).toHaveLength(1)
  })

  it('does not take a rule that the sheet rejected for the place of the theme rule', () => {
    const rules: string[] = []
    const sheet: Sheet = {
      rules,
      insert: () => undefined,
      replace: (index, rule) => void (rules[index] = rule),
    }
    const { cache } = setup({ sheet })
    const name = createThemeClass(cache, light)
    cache.css({ color: 'var(--u-a)' })
    cache.css({ color: 'var(--u-b)' })
    expect(cache.getRules(name)).toEqual([`.${name}{--u-a:1;}`, `.${name}{--u-b:2;}`])
  })

  it('returns the rules of another id as getRules does', () => {
    const { cache } = setup()
    const name = cache.css({ color: 'red' })
    expect(cache.getFullRules(name)).toEqual(cache.getRules(name))
    expect(cache.getFullRules('nothing')).toEqual([])
    expect(cache.getFullRules(createThemeClass(cache, {}))).toEqual([])
  })
})

describe('a cache without pruning', () => {
  it('declares every variable of a theme class at once and tracks no use', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ hasLayers: false, hasPruning: false, prefix: 'u', sheet })
    const name = createThemeClass(cache, light, { colorScheme: 'dark' })
    cache.css({ color: 'var(--u-a)' })
    cache.markUsed(['--u-b'])
    expect(cache.hasPruning).toBe(false)
    expect(cache.usedVariables.size).toBe(0)
    expect(sheet.rules[0]).toBe(`.${name}{--u-a:1;--u-b:2;--u-c:var(--u-b);color-scheme:dark;}`)
    expect(cache.getRules(name)).toEqual(cache.getFullRules(name))
    expect(createThemeClass(cache, light, { colorScheme: 'dark' })).toBe(name)
    expect(sheet.rules).toHaveLength(2)
  })
})

describe('a page extracted on the server and hydrated', () => {
  function serverPage() {
    const server = setup().cache
    const lightName = createThemeClass(server, light, { colorScheme: 'dark' })
    const darkName = createThemeClass(server, dark)
    const card = server.css({ color: 'var(--u-a)' })
    return { server, lightName, darkName, card }
  }

  it('marks the used variables in the ids', () => {
    const { server, lightName, darkName, card } = serverPage()
    expect(server.extract().ids).toEqual([lightName, darkName, card, '--u-a'])
    expect(createStyleTag(server)).toContain('--u-a">')
  })

  it('sends nothing again, and adds only the variable that is new, to each class that has it', () => {
    const { server, lightName, darkName, card } = serverPage()
    document.head.innerHTML = createStyleTag(server)

    const sheet = createMemorySheet()
    const client = createCache({ hasLayers: false, prefix: 'u', sheet })
    expect(client.usedVariables.has('--u-a')).toBe(true)
    // The same classes, in a different order, and a class that uses a covered variable.
    expect(createThemeClass(client, dark)).toBe(darkName)
    expect(createThemeClass(client, light, { colorScheme: 'dark' })).toBe(lightName)
    expect(client.css({ color: 'var(--u-a)' })).toBe(card)
    expect(sheet.rules).toEqual([])
    client.css({ margin: 'var(--u-d)' })
    expect(sheet.rules.filter((rule) => rule.startsWith('.u-theme'))).toEqual([
      `.${darkName}{--u-d:4;}`,
    ])
    client.css({ padding: 'var(--u-b)' })
    expect(sheet.rules.filter((rule) => rule.startsWith('.u-theme'))).toEqual([
      `.${darkName}{--u-d:4;}`,
      `.${lightName}{--u-b:2;}`,
    ])
  })

  it('does not lose a variable that was used on the client before the class was made', () => {
    const { server, lightName } = serverPage()
    document.head.innerHTML = createStyleTag(server)
    const sheet = createMemorySheet()
    const client = createCache({ hasLayers: false, prefix: 'u', sheet })
    client.css({ margin: 'var(--u-b)' })
    expect(createThemeClass(client, light, { colorScheme: 'dark' })).toBe(lightName)
    expect(client.getRules(lightName)).toEqual([`.${lightName}{--u-b:2;}`])
  })

  it('writes the whole class when the server did not send it', () => {
    const { server } = serverPage()
    document.head.innerHTML = createStyleTag(server)
    const sheet = createMemorySheet()
    const client = createCache({ hasLayers: false, prefix: 'u', sheet })
    const name = createThemeClass(client, { '--u-a': '5' }, { colorScheme: 'light' })
    expect(client.getRules(name)).toEqual([`.${name}{--u-a:5;color-scheme:light;}`])
  })

  it('appends to the style element of the server in the browser, and not twice', () => {
    const { server, darkName } = serverPage()
    document.head.innerHTML = createStyleTag(server)
    const count = () => document.querySelector('style')?.sheet?.cssRules.length
    const before = count()
    const client = createCache({ hasLayers: false, prefix: 'u', sheet: createDomSheet('u') })
    createThemeClass(client, dark)
    client.css({ color: 'var(--u-a)' })
    expect(count()).toBe(before)
    client.css({ margin: 'var(--u-d)' })
    client.css({ margin: 'var(--u-d)' })
    expect(count()).toBe((before ?? 0) + 2)
    const rules = [...(document.querySelector('style')?.sheet?.cssRules ?? [])].map(
      (rule) => rule.cssText
    )
    expect(rules.at(-1)).toContain(darkName)
    expect(rules.at(-1)).toContain('--u-d: 4')
  })
})
