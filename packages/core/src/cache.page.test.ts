import { createCache, createMemorySheet, type Sheet } from './cache'
import { createEngine } from './createEngine'
import { createStyleTag } from './extractStyles'
import { createThemeClass } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

/** A sheet that appends only: what a browser sheet does. */
function createAppendSheet(): Sheet {
  const rules: string[] = []
  return { rules, insert: (rule) => void rules.push(rule) }
}

/** A style element as React hoists it: the CSS is its text, the prefix its precedence. */
function addHoisted(css: string, parent: HTMLElement = document.head, prefix = 'u') {
  const element = document.createElement('style')
  element.dataset.precedence = prefix
  element.dataset.href = 'x'
  element.textContent = css
  parent.appendChild(element)
  return element
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const light = { '--u-a': '1', '--u-b': '2', '--u-c': '3' }
const dark = { '--u-a': '10', '--u-b': '20', '--u-c': '30' }

describe('a cache that reads the page it starts on', () => {
  it('knows the classes of the style elements that React hoisted, in the head or in the body', () => {
    addHoisted('@layer u-components{.u-one{color:red;}}')
    const container = document.createElement('div')
    document.body.appendChild(container)
    addHoisted('@layer u-components{.u-two:hover{color:red;}}', container)
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'u', sheet })
    expect(cache.insertOnce('u-one', ['a{}'], 'components')).toBe(false)
    expect(cache.insertOnce('u-two', ['a{}'], 'components')).toBe(false)
    expect(cache.insertOnce('u-three', ['a{}'], 'components')).toBe(true)
    expect(sheet.rules.at(-1)).toBe('@layer u-components{a{}}')
  })

  it('knows the layer order statement, so that it writes none of its own', () => {
    addHoisted(
      '@layer u-theme,u-global,u-components,u-overrides;@layer u-components{.u-one{color:red;}}'
    )
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'u', sheet })
    cache.css({ color: 'blue' })
    expect(sheet.rules).toHaveLength(1)
    expect(sheet.rules[0]).toMatch(/^@layer u-components\{/)
  })

  it('learns the used variables from the rules of the page, so a theme class made later gets them', () => {
    addHoisted('.u-one{color:var(--u-a);margin:var(--u-c);}')
    const sheet = createAppendSheet()
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet })
    expect(cache.usedVariables).toEqual(new Set(['--u-a', '--u-c']))
    const name = createThemeClass(cache, dark, { colorScheme: 'dark' })
    expect(sheet.rules).toEqual([`.${name}{--u-a:10;--u-c:30;color-scheme:dark;}`])
  })

  it('takes a theme rule that the page has for sent: only the variables it lacks are appended', () => {
    const name = createThemeClass(
      createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() }),
      light,
      { colorScheme: 'light' }
    )
    addHoisted(`.${name}{--u-a:1;color-scheme:light;}.u-one{color:var(--u-a);margin:var(--u-b);}`)
    const sheet = createAppendSheet()
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet })
    expect(createThemeClass(cache, light, { colorScheme: 'light' })).toBe(name)
    expect(sheet.rules).toEqual([`.${name}{--u-b:2;}`])
  })

  it('does not write the variables of a theme that the page has in full', () => {
    const server = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    const name = createThemeClass(server, light, { colorScheme: 'light' })
    addHoisted(server.getFullRules(name).join(''))
    const sheet = createAppendSheet()
    const client = createCache({ hasLayers: false, prefix: 'u', sheet })
    expect(createThemeClass(client, light, { colorScheme: 'light' })).toBe(name)
    client.css({ color: 'var(--u-a)', margin: 'var(--u-b)' })
    expect(sheet.rules).toEqual([
      expect.stringMatching(/^\.u-\w+\{color:var\(--u-a\);margin:var\(--u-b\);\}$/),
    ])
  })

  it('does not write a @property rule that the page has, and writes one that it lacks', () => {
    const rule = '@property --u-a{syntax:"<color>";inherits:true;initial-value:#fff;}'
    const other = '@property --u-b{syntax:"<color>";inherits:true;initial-value:#000;}'
    addHoisted(`${rule}.u-x{color:var(--u-a);margin:var(--u-b);}`)
    const sheet = createAppendSheet()
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet })
    cache.registerProperties({ '--u-a': rule, '--u-b': other })
    expect(sheet.rules).toEqual([other])
  })

  it('reads the elements once, and those that arrive after start-up as they arrive', async () => {
    const sheet = createAppendSheet()
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet })
    const name = createThemeClass(cache, dark, { colorScheme: 'dark' })
    expect(sheet.rules).toEqual([`.${name}{color-scheme:dark;}`])

    addHoisted('.u-late{color:var(--u-b);}')
    await settle()
    expect(cache.insertOnce('u-late', ['a{}'])).toBe(false)
    expect(cache.usedVariables.has('--u-b')).toBe(true)
    // The theme class that the page did not offer gets the variable that the new rule needs.
    expect(sheet.rules).toEqual([`.${name}{color-scheme:dark;}`, `.${name}{--u-b:20;}`])
  })

  it('notices a rule that arrives with a theme class the cache already made', async () => {
    const sheet = createAppendSheet()
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet })
    const name = createThemeClass(cache, light, { colorScheme: 'light' })
    addHoisted(
      `.${name}{--u-a:1;--u-b:2;color-scheme:light;}.u-x{color:var(--u-a);margin:var(--u-b);}`
    )
    await settle()
    expect(sheet.rules).toEqual([`.${name}{color-scheme:light;}`])
    cache.css({ padding: 'var(--u-c)' })
    expect(sheet.rules.filter((rule) => rule.startsWith(`.${name}`))).toEqual([
      `.${name}{color-scheme:light;}`,
      `.${name}{--u-c:3;}`,
    ])
  })

  it('ignores what arrives in the head that is not an element of its own', async () => {
    const sheet = createAppendSheet()
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet })
    const used = new Set(cache.usedVariables)
    document.head.appendChild(document.createTextNode('text'))
    addHoisted('.u-other{color:var(--u-a);}', document.head, 'other')
    const link = document.createElement('link')
    document.head.appendChild(link)
    const unrelated = document.createElement('style')
    unrelated.textContent = '.u-x{color:var(--u-a);}'
    document.head.appendChild(unrelated)
    await settle()
    expect(cache.usedVariables).toEqual(used)
    expect(cache.insertOnce('u-other', ['a{}'])).toBe(true)
  })

  it('does not read the same element twice', async () => {
    const element = addHoisted('.u-x{color:var(--u-a);}')
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet: createAppendSheet() })
    const before = new Set(cache.usedVariables)
    element.remove()
    document.head.appendChild(element)
    await settle()
    expect(cache.usedVariables).toEqual(before)
  })

  it('does not track variables without pruning', () => {
    addHoisted('.u-theme-1{--u-a:1;}.u-x{color:var(--u-a);}')
    const cache = createCache({
      hasLayers: false,
      hasPruning: false,
      prefix: 'u',
      sheet: createAppendSheet(),
    })
    expect(cache.usedVariables.size).toBe(0)
    expect(cache.insertOnce('u-theme-1', ['a{}'])).toBe(false)
  })

  it('stays out of the way where there is no document element to read from', () => {
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet: createAppendSheet() })
    expect(cache.usedVariables.size).toBe(0)
  })
})

describe('the stamp of the options', () => {
  it('is on the style element that a server wrote, and the browser accepts the same options', () => {
    const server = createCache({ prefix: 'u', sheet: createMemorySheet() })
    server.css({ color: 'red' })
    document.head.innerHTML = createStyleTag(server)
    expect(() => createCache({ prefix: 'u', sheet: createMemorySheet() })).not.toThrow()
  })

  it('throws one error that names the options that differ, from a style element', () => {
    const server = createCache({
      prefix: 'u',
      hasLayers: false,
      hasScope: false,
      sheet: createMemorySheet(),
    })
    document.head.innerHTML = createStyleTag(server)
    expect(() => createCache({ prefix: 'u', sheet: createMemorySheet() })).toThrow(
      /Differing options: hasLayers \(server: 0, browser: 1\); hasScope \(server: 0, browser: 1\)\./
    )
  })

  it('reads the stamp from the meta element of a server render, too', () => {
    const server = createCache({ prefix: 'u', suffix: '-s', sheet: createMemorySheet() })
    document.head.innerHTML = `<meta name="u-options" content="${server.fingerprint}">`
    expect(() =>
      createCache({ prefix: 'u', suffix: '-s', sheet: createMemorySheet() })
    ).not.toThrow()
    expect(() => createCache({ prefix: 'u', sheet: createMemorySheet() })).toThrow(
      /suffix \(server: -s, browser: \)/
    )
  })

  it('includes the token options of an engine', () => {
    const server = createEngine({ a: { b: '#fff' } }, { prefix: 'u', modes: { a: 'inline' } })
    document.head.innerHTML = createStyleTag(server.cache)
    expect(() => createEngine({ a: { b: '#fff' } }, { prefix: 'u' })).toThrow(
      /tokens \(server: \w+, browser: \)/
    )
    expect(() =>
      createEngine({ a: { b: '#fff' } }, { prefix: 'u', modes: { a: 'inline' } })
    ).not.toThrow()
  })
})

describe('themes that the app switches with a class on <html>', () => {
  it('get a variable that is first used after a navigation, though no provider rendered them', () => {
    const engine = createEngine({ palette: { primary: '#00f', accent: '#f00' } }, { prefix: 'u' })
    const darkClass = engine.themeClass({ palette: { primary: '#88f', accent: '#f88' } }, 'dark')
    const darkId = darkClass.split(' ')[0]
    expect(engine.cache.extract().css).not.toContain('--u-palette')

    engine.cache.css({ color: engine.refs.palette.primary })
    expect(engine.cache.extract().css).toContain(`.${darkId}{--u-palette-primary:#88f;}`)
    expect(engine.cache.extract().css).not.toContain('--u-palette-accent:#f88')

    // Later, on another page, a component uses a token that no earlier one did.
    engine.cache.css({ borderColor: engine.refs.palette.accent })
    expect(engine.cache.extract().css).toContain(`.${darkId}{--u-palette-accent:#f88;}`)
  })
})
