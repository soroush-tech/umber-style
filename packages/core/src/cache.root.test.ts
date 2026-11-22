import { createCache, createMemorySheet, type Sheet } from './cache'
import { createStyleTag } from './extractStyles'
import { declareRootTheme } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
})

const light = { '--u-a': '1', '--u-b': '2', '--u-c': 'var(--u-b)' }
const dark = { '--u-a': '10', '--u-b': '20', '--u-c': 'var(--u-b)' }

/** A sheet that appends only. */
function createAppendSheet(): Sheet {
  const rules: string[] = []
  return { rules, insert: (rule) => void rules.push(rule) }
}

function setup(options: { hasPruning?: boolean; hasLayers?: boolean; sheet?: Sheet } = {}) {
  const sheet = options.sheet ?? createMemorySheet()
  const cache = createCache({ hasLayers: false, prefix: 'u', ...options, sheet })
  const roots = () => sheet.rules.filter((rule) => rule.includes(':where(:root)'))
  return { cache, sheet, roots }
}

describe('the root theme of a cache', () => {
  it('declares the used variables on :root, with no specificity, more as they become used', () => {
    const { cache, roots } = setup()
    const id = declareRootTheme(cache, light)
    expect(id).toMatch(/^u-root-/)
    expect(roots()).toEqual([])
    cache.css({ color: 'var(--u-a)' })
    expect(roots()).toEqual([':where(:root){--u-a:1;}'])
    cache.css({ margin: 'var(--u-c)' })
    expect(roots()).toEqual([':where(:root){--u-a:1;--u-c:var(--u-b);--u-b:2;}'])
    expect(cache.getRules(id)).toEqual(roots())
    expect(cache.extract().ids).toContain(id)
  })

  it('writes nothing again for a variable that it does not declare', () => {
    const { cache, sheet } = setup()
    cache.css({ color: 'var(--u-a)' })
    declareRootTheme(cache, light)
    const before = [...sheet.rules]
    cache.markUsed(['--u-z'])
    expect(sheet.rules).toEqual(before)
  })

  it('names the root theme like a theme class: the hash of all its declarations and its scheme', () => {
    const { cache } = setup()
    const plain = declareRootTheme(cache, light)
    expect(declareRootTheme(cache, light)).toBe(plain)
    expect(declareRootTheme(cache, light, { colorScheme: 'dark' })).not.toBe(plain)
    expect(declareRootTheme(cache, dark)).not.toBe(plain)
  })

  it('writes every variable at once without pruning, in the theme layer with layers', () => {
    const { cache, roots } = setup({ hasPruning: false, hasLayers: true })
    declareRootTheme(cache, light, { colorScheme: 'dark' })
    expect(roots()).toEqual([
      '@layer u-theme{:where(:root){--u-a:1;--u-b:2;--u-c:var(--u-b);color-scheme:dark;}}',
    ])
  })

  it('writes the color-scheme alone while no variable is used', () => {
    const { cache, roots } = setup()
    declareRootTheme(cache, light, { colorScheme: 'light' })
    expect(roots()).toEqual([':where(:root){color-scheme:light;}'])
  })

  it('declares what the value of a used variable refers to, when the root theme comes late', () => {
    const { cache, roots } = setup()
    cache.css({ color: 'var(--u-c)' })
    declareRootTheme(cache, light)
    expect(roots()).toEqual([':where(:root){--u-c:var(--u-b);--u-b:2;}'])
  })

  it('replaces the rule of the root theme before it, and does nothing for the same one again', () => {
    const { cache, sheet, roots } = setup()
    cache.css({ color: 'var(--u-a)' })
    const first = declareRootTheme(cache, light)
    const second = declareRootTheme(cache, dark)
    expect(roots()).toEqual([':where(:root){--u-a:10;}'])
    expect(cache.extract().ids).toContain(second)
    expect(cache.extract().ids).not.toContain(first)
    const before = [...sheet.rules]
    declareRootTheme(cache, dark)
    expect(sheet.rules).toEqual(before)
    declareRootTheme(cache, light)
    expect(roots()).toEqual([':where(:root){--u-a:1;}'])
  })

  it('removes the rule when the next root theme has nothing to write', () => {
    const { cache, roots } = setup()
    cache.css({ color: 'var(--u-a)' })
    declareRootTheme(cache, light)
    declareRootTheme(cache, { '--u-z': '1' })
    expect(roots()).toEqual([])
  })

  it('appends the new rule in a sheet that cannot remove: the later one wins', () => {
    const { cache, roots } = setup({ sheet: createAppendSheet() })
    cache.css({ color: 'var(--u-a)' })
    declareRootTheme(cache, light)
    declareRootTheme(cache, dark)
    expect(roots()).toEqual([':where(:root){--u-a:1;}', ':where(:root){--u-a:10;}'])
  })

  it('keeps the places of global rules right when its rule moves, and its own when they go', () => {
    const { cache, sheet, roots } = setup()
    cache.css({ color: 'var(--u-a)' })
    const first = cache.insertGlobal(cache.compileGlobal({ body: { margin: 0 } }))
    declareRootTheme(cache, light)
    const second = cache.insertGlobal(cache.compileGlobal({ p: { margin: 0 } }))
    // The root rule moves to the end: the global rule after it moves down.
    cache.css({ margin: 'var(--u-b)' })
    first()
    expect(sheet.rules.some((rule) => rule.startsWith('body'))).toBe(false)
    second()
    expect(sheet.rules.some((rule) => rule.startsWith('p{'))).toBe(false)
    cache.css({ padding: 'var(--u-c)' })
    expect(roots()).toEqual([':where(:root){--u-a:1;--u-b:2;--u-c:var(--u-b);}'])
    expect(sheet.rules.filter((rule) => rule.includes(':where(:root)'))).toHaveLength(1)
  })

  it('gives every declaration of any root theme it was given, for a style element', () => {
    const { cache } = setup()
    cache.registerProperties({ '--u-a': '@property --u-a{syntax:"*";inherits:true;}' })
    const first = declareRootTheme(cache, light, { colorScheme: 'light' })
    declareRootTheme(cache, dark)
    expect(cache.getFullRules(first)).toEqual([
      '@property --u-a{syntax:"*";inherits:true;}',
      ':where(:root){--u-a:1;--u-b:2;--u-c:var(--u-b);color-scheme:light;}',
    ])
  })
})

describe('the root theme of a page', () => {
  it('is the one in the sheet, with the variables the page uses, before the theme classes', () => {
    const { cache } = setup({ hasLayers: true })
    const name = cache.css({ color: 'var(--u-a)' })
    cache.css({ margin: 'var(--u-b)' })
    declareRootTheme(cache, light)
    const id = declareRootTheme(cache, dark, { colorScheme: 'dark' })
    const page = cache.extractPage([name])
    expect(page.css).toBe(
      '@layer u-theme,u-global,u-components,u-overrides;' +
        '@layer u-theme{:where(:root){--u-a:10;color-scheme:dark;}}' +
        `@layer u-components{.${name}{color:var(--u-a);}}`
    )
    expect(page.ids).toEqual([id, name])
  })

  it('is left out when the markup carries it, and is all of it without pruning', () => {
    const { cache } = setup({ hasPruning: false })
    const id = declareRootTheme(cache, light)
    expect(cache.extractPage([], { carried: new Set([id]) })).toEqual({ css: '', ids: [] })
    expect(cache.extractPage([]).css).toBe(':where(:root){--u-a:1;--u-b:2;--u-c:var(--u-b);}')
  })

  it('is not there before any root theme was given', () => {
    const { cache } = setup()
    expect(cache.extractPage([]).ids).toEqual([])
  })
})

describe('the root rules of a page that a server rendered', () => {
  /** Puts the style element of a server render into the head, with `css`. */
  function addServerStyle(css: string) {
    const element = document.createElement('style')
    element.dataset.style = 'u'
    element.textContent = css
    document.head.appendChild(element)
    return element
  }

  it('are removed when the browser cache declares its root theme, the first time', () => {
    const server = setup()
    server.cache.css({ color: 'var(--u-a)' })
    declareRootTheme(server.cache, light)
    const element = addServerStyle(
      createStyleTag(server.cache).replace(/^<style[^>]*>|<\/style>$/g, '')
    )
    const sheet = createMemorySheet()
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet })
    const texts = () => [...(element.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText)
    expect(texts().some((text) => text.includes(':root'))).toBe(true)
    declareRootTheme(cache, dark)
    expect(texts().some((text) => text.includes(':root'))).toBe(false)
    expect(sheet.rules).toEqual([':where(:root){--u-a:10;}'])
  })

  it('are found in the theme layer, and left where the browser kept a different number of rules', () => {
    const layered = addServerStyle('@layer u-theme{:where(:root){--u-a:1;}}')
    const kept = addServerStyle(':where(:root){--u-a:1;}@unknown{}')
    const cache = createCache({ prefix: 'u', sheet: createMemorySheet() })
    declareRootTheme(cache, light)
    expect((layered.sheet as CSSStyleSheet).cssRules).toHaveLength(0)
    expect((kept.sheet as CSSStyleSheet).cssRules).toHaveLength(1)
  })
})

describe('the root rules of a registry element streamed into the body', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  /** A style element of a registry, `data-umber="u <ids>"`, added to the body as a late chunk is. */
  function addLateElement(css: string) {
    const element = document.createElement('style')
    element.setAttribute('data-umber', 'u u-root-late')
    element.textContent = css
    document.body.appendChild(element)
    return element
  }
  const hasRoot = (element: HTMLStyleElement) =>
    [...(element.sheet as CSSStyleSheet).cssRules].some((rule) => rule.cssText.includes(':root'))

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('are removed with those of the head when the element is there before the browser cache declares its root theme', () => {
    const late = addLateElement(':where(:root){--u-a:1;--u-b:2;}')
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    declareRootTheme(cache, dark)
    expect(hasRoot(late)).toBe(false)
  })

  it('are removed on arrival when the element comes after the browser cache declared its root theme', async () => {
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    declareRootTheme(cache, dark)
    const late = addLateElement(':where(:root){--u-a:1;--u-b:2;}')
    await settle()
    expect(hasRoot(late)).toBe(false)
  })

  it('are removed on arrival after a switch of the theme, so the theme switched to stays in effect', async () => {
    // A cache whose sheet is in the page, so that the computed value on the root shows what is in effect.
    const cache = createCache({ hasLayers: false, prefix: 'u' })
    cache.css({ color: 'var(--u-a)' })
    const readA = () => getComputedStyle(document.documentElement).getPropertyValue('--u-a')
    declareRootTheme(cache, light)
    expect(readA()).toBe('1')
    // The theme is switched while the page streams; then the late chunk arrives with the server's root rule.
    declareRootTheme(cache, dark)
    expect(readA()).toBe('10')
    const late = addLateElement(':where(:root){--u-a:1;--u-b:2;}')
    await settle()
    expect(hasRoot(late)).toBe(false)
    expect(readA()).toBe('10')
  })

  it('are removed on arrival with the other rules of the element kept', async () => {
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    declareRootTheme(cache, dark)
    const late = addLateElement('.u-late-1abc{color:var(--u-a);}:where(:root){--u-a:1;}')
    await settle()
    const texts = [...(late.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText)
    expect(texts).toHaveLength(1)
    expect(texts[0]).toContain('.u-late-1abc')
  })

  it('are left on arrival where the browser kept a different number of rules', async () => {
    const cache = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
    declareRootTheme(cache, dark)
    const late = addLateElement(':where(:root){--u-a:1;}@unknown{}')
    await settle()
    expect(hasRoot(late)).toBe(true)
  })
})
