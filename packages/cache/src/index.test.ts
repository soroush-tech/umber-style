import {
  createDomSheet,
  createEngine,
  createMemorySheet,
  extractPageStyles,
  type UmberCache as CoreUmberCache,
} from '@umber-style/core'
import { expectTypeOf } from 'vitest'
import createCache, { type SerializedRule, type UmberCache } from './index'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }

/** A cache as a server render has it: its rules in memory. */
function createServerCache(key = 'app') {
  return createCache({ key, sheet: createMemorySheet(), hasDevChecks: false })
}

/** Renders a little page through an engine over `cache`: a theme, a class with an animation, global rules. */
function renderPage(cache: UmberCache) {
  const engine = createEngine(theme, { cache })
  const themeClass = engine.themeClass(theme, 'light')
  const fade = engine.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
  const box = engine.css({ color: engine.refs.palette.primary, animation: `${fade} 1s` })
  engine.insertGlobal({ body: { margin: engine.refs.space[1] } })
  return { engine, themeClass, fade, box }
}

/** Wraps `insert` as an app's registry does, and returns what it collects. */
function wrapInsert(cache: UmberCache) {
  const prevInsert = cache.insert
  const seen: { name: string; before: unknown }[] = []
  cache.insert = (...args) => {
    const serialized = args[1]
    seen.push({ name: serialized.name, before: cache.inserted[serialized.name] })
    return prevInsert(...args)
  }
  return seen
}

describe('createCache', () => {
  it('makes the UmberCache that the core declares and this package re-exports', () => {
    expectTypeOf<UmberCache>().toEqualTypeOf<CoreUmberCache>()
    expectTypeOf(createCache).returns.toEqualTypeOf<CoreUmberCache>()
  })

  it('is the engine cache keyed by `key`, and throws for a key the engine refuses', () => {
    const cache = createServerCache('soroush')
    expect(cache.key).toBe('soroush')
    expect(cache.prefix).toBe('soroush')
    expect(cache.compat).toBe(false)
    expect(cache.css({ color: 'red' })).toMatch(/^soroush-\w+$/)
    expect(() => createCache({ key: 'Bad Key' })).toThrow('Invalid cache prefix "Bad Key"')
  })

  it('calls insert once for every new group of rules, with its name, and records it', () => {
    const cache = createServerCache()
    const seen = wrapInsert(cache)
    const { themeClass, fade, box } = renderPage(cache)
    const names = seen.map(({ name }) => name)
    expect(names).toEqual([...new Set(names)])
    expect(names).toEqual(
      expect.arrayContaining([
        'app-layers',
        themeClass.split(' ')[0],
        `@keyframes:${fade}`,
        box,
        expect.stringMatching(/^app-global-\w+$/),
      ])
    )
    expect(seen.every(({ before }) => before === undefined)).toBe(true)
    expect(names.every((name) => cache.inserted[name] === true)).toBe(true)
    cache.css({ color: 'red' })
    cache.css({ color: 'red' })
    expect(seen).toHaveLength(names.length + 1)
  })

  it('records the CSS text of each rule when compat is set, everything the browser needs for it', () => {
    const cache = createServerCache()
    cache.compat = true
    const { box, fade, themeClass } = renderPage(cache)
    expect(cache.inserted['app-layers']).toBe(
      '@layer app-theme,app-global,app-components,app-overrides;'
    )
    expect(cache.inserted[box]).toBe(cache.getRules(box).join(''))
    expect(cache.inserted[box]).toMatch(/^@layer app-components\{/)
    const css = Object.values(cache.inserted).join('')
    const themeId = themeClass.split(' ')[0]
    expect(css).toContain(`@layer app-theme{.${themeId}{--app-palette-primary:#0000ff;}}`)
    expect(css).toContain(`@layer app-theme{.${themeId}{--app-space-1:4px;}}`)
    expect(css).toContain(`@keyframes ${fade}{`)
    expect(css).toContain('@layer app-global{body{margin:var(--app-space-1);}}')
  })

  it('records nothing for an insert that is not to be cached', () => {
    const cache = createServerCache()
    cache.insert('', { name: 'x', styles: 'a{}' }, cache.sheet, false)
    expect(cache.inserted).toEqual({})
  })

  it('reads registered as a map, and by class name', () => {
    const cache = createServerCache()
    const box = cache.css({ color: 'red' })
    expect(cache.registered.get(box)).toEqual({ color: 'red' })
    expect(cache.registered.size).toBe(1)
    expect(cache.registered[box]).toBe(true)
    expect(cache.registered['app-missing']).toBeUndefined()
  })

  it('puts a set of global rules that a component rendered in the page that names it only, and a set of the app in every page', () => {
    const cache = createServerCache()
    const engine = createEngine(theme, { cache })
    const [promo] = engine.resolveGlobal({ nav: { color: 'red' } })
    cache.insertGlobal(promo, { isRendered: true })
    engine.insertGlobal({ body: { margin: 0 } })
    const marked = extractPageStyles(cache, `<meta name="app-global" content="${promo.id}"><p></p>`)
    expect(marked.css).toContain('@layer app-global{nav{color:red;}}')
    expect(marked.css).toContain('@layer app-global{body{margin:0;}}')
    const other = extractPageStyles(cache, '<p></p>')
    expect(other.css).not.toContain('nav{')
    expect(other.css).toContain('@layer app-global{body{margin:0;}}')
    // Every name of the cache is still recorded.
    expect(cache.inserted[promo.id]).toBe(true)
  })

  it('keeps the rules of two caches apart', () => {
    const first = createServerCache()
    const second = createServerCache()
    const one = first.css({ color: 'red' })
    second.css({ color: 'blue' })
    expect(Object.keys(first.inserted)).toEqual(['app-layers', one])
    expect(second.inserted[one]).toBeUndefined()
  })
})

describe('a cache made in the browser', () => {
  /** The page the registry of an app writes: one style element for each flush, keyed by the cache. */
  function writeRegistryPage() {
    const server = createServerCache('soroush')
    server.compat = true
    let collected: string[] = []
    const prevInsert = server.insert
    server.insert = (...args: [string, SerializedRule, UmberCache['sheet'], boolean]) => {
      const serialized = args[1]
      if (server.inserted[serialized.name] === undefined) collected.push(serialized.name)
      return prevInsert(...args)
    }
    const flush = () => {
      const names = collected
      collected = []
      let styles = ''
      for (const name of names) styles += server.inserted[name]
      return `<style data-umber="${server.key} ${names.join(' ')}">${styles}</style>`
    }
    const made = renderPage(server)
    document.head.innerHTML = flush()
    document.body.innerHTML = `<div class="${made.themeClass}"><p class="${made.box}"></p></div>`
    return made
  }

  it('lists its own style element and those of its key, and knows the names they carry', () => {
    const { box } = writeRegistryPage()
    const cache = createCache({ key: 'soroush', hasDevChecks: false })
    expect(cache.sheet.tags.map((tag) => tag.getAttribute('data-umber') ?? 'own')).toEqual([
      expect.stringMatching(/^soroush soroush-layers /),
      'own',
    ])
    expect(cache.inserted[box]).toBe(true)
    expect(cache.inserted['soroush-layers']).toBe(true)
  })

  it('writes none of the rules that arrived in data-umber elements: classes, globals, keyframes, themes', () => {
    const made = writeRegistryPage()
    const cache = createCache({ key: 'soroush', hasDevChecks: false })
    const seen = wrapInsert(cache)
    const again = renderPage(cache)
    expect(again.box).toBe(made.box)
    expect(seen).toEqual([])
    const own = document.querySelector<HTMLStyleElement>('style[data-style="soroush"]')
    expect(own?.sheet?.cssRules).toHaveLength(0)
  })

  it('reads the document of its sheet: the style elements of an iframe, and not those of the page', () => {
    writeRegistryPage()
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frame = iframe.contentDocument as Document
    frame.head.innerHTML =
      '<style data-umber="soroush soroush-framed">.soroush-framed{color:red;}</style>'
    const cache = createCache({
      key: 'soroush',
      sheet: createDomSheet('soroush', frame.head),
      hasDevChecks: false,
    })
    expect(cache.sheet.tags.map((tag) => tag.getAttribute('data-umber') ?? 'own')).toEqual([
      'soroush soroush-framed',
      'own',
    ])
    expect(cache.inserted).toEqual({ 'soroush-framed': true })
  })
})

describe('how the style element of the cache is written', () => {
  /** The text of the style elements of the cache `key`, joined in document order. */
  const readText = (key: string) =>
    [...document.querySelectorAll(`style[data-style="${key}"]`)]
      .map((element) => element.textContent)
      .join('')

  it('holds the rules as text outside production, and writes them with insertRule with speedy', () => {
    const text = createCache({ key: 'text', hasDevChecks: false })
    const box = text.css({ color: 'red' })
    expect(readText('text')).toBe(
      `@layer text-theme,text-global,text-components,text-overrides;@layer text-components{.${box}{color:red;}}`
    )
    createCache({ key: 'speedy', speedy: true, hasDevChecks: false }).css({ color: 'red' })
    createCache({ key: 'slow', speedy: false, hasDevChecks: false }).css({ color: 'red' })
    expect(readText('speedy')).toBe('')
    expect(readText('slow')).toContain('{color:red;}')
  })

  it('warns once in development about hasRuleText, which was renamed to speedy and is not read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', 'development')
    // @ts-expect-error hasRuleText is no option: it was renamed to speedy.
    createCache({ key: 'renamed', hasRuleText: false, hasDevChecks: false }).css({ color: 'red' })
    vi.unstubAllEnvs()
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[renamed] The option hasRuleText was renamed to speedy, with the opposite meaning: hasRuleText: false is not read, and the default applies. Write speedy: true instead.',
    ])
    // The default of development: the rules as text.
    expect(readText('renamed')).toContain('{color:red;}')
    warn.mockRestore()
  })

  it('carries the nonce it is given, in either way of writing, and keeps it as `nonce`', () => {
    const text = createCache({ key: 'strict', nonce: 'n0nce', hasDevChecks: false })
    const fast = createCache({ key: 'fast', nonce: 'n0nce', speedy: true, hasDevChecks: false })
    text.css({ color: 'red' })
    fast.css({ color: 'red' })
    for (const key of ['strict', 'fast']) {
      expect(document.querySelector(`style[data-style="${key}"]`)?.getAttribute('nonce')).toBe(
        'n0nce'
      )
    }
    expect([text.nonce, fast.nonce]).toEqual(['n0nce', 'n0nce'])
    // By text, the layer order and the class are an element each, both with the nonce.
    expect(text.sheet.tags.map((tag) => tag.getAttribute('nonce'))).toEqual(['n0nce', 'n0nce'])
  })
})

describe('the options of createCache', () => {
  it('throws for onInsert, which the cache sets itself, and passes the style options on', () => {
    expect(() =>
      createCache({ key: 'app', onInsert: () => undefined } as Parameters<typeof createCache>[0])
    ).toThrow(
      new TypeError(
        "createCache(): `onInsert` is the cache's own: it calls `insert` for every group of rules it writes. Replace `cache.insert` to see each rule."
      )
    )
    const cache = createCache({ key: 'app', sheet: createMemorySheet(), hasVendorPrefixes: false })
    const name = cache.css({ userSelect: 'none' })
    expect(cache.getRules(name)).toEqual([`@layer app-components{.${name}{user-select:none;}}`])
  })
})
