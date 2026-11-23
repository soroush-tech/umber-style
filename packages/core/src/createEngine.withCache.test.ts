import { createCache, createMemorySheet } from './cache'
import { createEngine, createLazyEngine } from './createEngine'
import { findEntryCache, readEntrySource } from './sheetEntry'

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }
type Theme = typeof theme

function createSheetCache(prefix: string) {
  const sheet = createMemorySheet()
  return { sheet, cache: createCache({ prefix, sheet, hasDevChecks: false }) }
}

describe('withCache', () => {
  it('is the engine itself for its own cache, and one engine for each other cache', () => {
    const base = createSheetCache('css')
    const engine = createEngine(theme, { cache: base.cache })
    const other = createSheetCache('frame')
    const derived = engine.withCache(other.cache)
    expect(engine.withCache(base.cache)).toBe(engine)
    expect(engine.withCache(other.cache)).toBe(derived)
    expect(derived.cache).toBe(other.cache)
    expect(derived.withCache(base.cache)).toBe(engine)
  })

  it('writes classes and variables with the prefix of the other cache, and nothing into its own', () => {
    const base = createSheetCache('css')
    const engine = createEngine(theme, { cache: base.cache })
    const other = createSheetCache('frame')
    const derived = engine.withCache(other.cache)
    const name = derived.css({ color: derived.refs.palette.primary })
    derived.declareRoot(theme)
    expect(name).toMatch(/^frame-/)
    expect(other.sheet.rules.join('')).toContain(`.${name}{color:var(--frame-palette-primary);}`)
    expect(other.sheet.rules.join('')).toContain(':where(:root){--frame-palette-primary:#0000ff;}')
    expect(base.sheet.rules).toEqual([])
  })

  it('makes the tokens of the base theme once for a prefix, and writes for a fresh cache what it wrote before', () => {
    // The engine of each fresh cache of one prefix reads the tokens that the family made for the base
    // theme; the classes, rules and variables are those that tokens of its own gave.
    const engine = createEngine(theme, { cache: createSheetCache('css').cache })
    const write = (cache: ReturnType<typeof createSheetCache>) => {
      const derived = engine.withCache(cache.cache)
      const styler = derived.createStyler({ name: 'Box' }, [
        ({ theme: view }: { theme: Theme }) => ({
          color: view.palette.primary,
          padding: view.space[2],
        }),
      ])
      const className = styler.getClassName({}, undefined, derived.createThemeView(theme))
      derived.declareRoot(theme)
      return { derived, className, rules: [...cache.sheet.rules] }
    }
    const first = write(createSheetCache('fresh'))
    const second = write(createSheetCache('fresh'))
    expect(second.derived).not.toBe(first.derived)
    expect(second.derived.refs).toBe(first.derived.refs)
    expect(second.className).toBe(first.className)
    expect(second.rules).toEqual(first.rules)
    expect(first.rules).toEqual([
      '@layer fresh-theme,fresh-global,fresh-components,fresh-overrides;',
      '@layer fresh-components{.fresh-box-root-13m7lrk{color:var(--fresh-palette-primary);padding:var(--fresh-space-2);}}',
      '@layer fresh-theme{:where(:root){--fresh-palette-primary:#0000ff;--fresh-space-2:8px;}}',
    ])
    // The same rules as 0.3.0 wrote for these calls. Another prefix has tokens of its own, and so does
    // another base theme.
    const firstRefs = first.derived.refs
    const other = write(createSheetCache('else'))
    expect(other.derived.refs).not.toBe(first.derived.refs)
    expect(other.derived.refs.palette.primary).toBe('var(--else-palette-primary)')
    const next = { palette: { primary: '#00ff00', accent: '#ff0000' }, space: [0, 2, 4] }
    engine.setTheme(next)
    const after = engine.withCache(createSheetCache('fresh').cache)
    expect(after.refs).not.toBe(firstRefs)
    expect(after.readThemeText(next).declarations).toContain('--fresh-space-2:4px;')
  })

  it('shares the base theme: a theme given to either is the base of both', () => {
    const engine = createLazyEngine<Theme>({ cache: createSheetCache('css').cache })
    const derived = engine.withCache(createSheetCache('frame').cache)
    expect(derived.hasTheme).toBe(false)
    derived.setTheme(theme)
    expect(engine.baseTheme).toBe(theme)
    expect(engine.refs.palette.primary).toBe('var(--css-palette-primary)')
    const next = { ...theme, palette: { ...theme.palette, primary: '#00ff00' } }
    engine.setTheme(next)
    expect(derived.baseTheme).toBe(next)
    expect(derived.themeClass(next)).toMatch(/^frame-theme-/)
  })

  it('makes a themed sheet again against the new base theme of another engine of the family', () => {
    const engine = createEngine(theme, { cache: createSheetCache('css').cache })
    const derived = engine.withCache(createSheetCache('frame').cache)
    const sheet = derived.createSheet((view) => ({ box: { margin: view.space[1] } }))
    const first = sheet.resolve()
    expect(sheet.resolve()).toBe(first)
    engine.setTheme({ ...theme })
    expect(sheet.resolve()).not.toBe(first)
  })

  it('keeps the token options of the engine', () => {
    const cache = createSheetCache('frame')
    const engine = createEngine(theme, {
      cache: createSheetCache('css').cache,
      alwaysDeclare: ['palette.accent'],
    })
    const derived = engine.withCache(cache.cache)
    derived.declareRoot(theme)
    expect(cache.sheet.rules.join('')).toContain('--frame-palette-accent:#ff0000;')
  })
})

describe('the options of the style under another cache', () => {
  it('keeps value repair, colour fallbacks and the base class of the engine, which describe how its styles are written', () => {
    const engine = createEngine(theme, {
      prefix: 'css',
      hasValueRepair: true,
      hasColorFallbacks: false,
      hasBaseClass: false,
    })
    const other = createSheetCache('frame')
    const derived = engine.withCache(other.cache)
    const name = derived.css({ color: `${derived.refs.palette.primary}20`, margin: '-var(--gap)' })
    expect(other.sheet.rules).toContain(
      `@layer frame-components{.${name}{color:color-mix(in srgb, var(--frame-palette-primary) 12.55%, transparent);margin:calc(var(--gap) * -1);}}`
    )
    const styler = derived.createStyler({ label: 'Box' }, [{ padding: 0 }, () => ({ margin: 0 })])
    expect(styler.getClassName({}).split(' ')).toHaveLength(1)
  })

  it('takes from the cache what the engine was not given, and what the cache holds: layers, labels, the suffix', () => {
    const engine = createEngine(theme, { prefix: 'css' })
    const sheet = createMemorySheet()
    const cache = createCache({
      prefix: 'frame',
      sheet,
      hasValueRepair: true,
      hasColorFallbacks: false,
      hasLayers: false,
      suffix: '-x',
    })
    const name = engine.withCache(cache).css({ label: 'Box', color: 'var(--c)20' })
    expect(name).toMatch(/^frame-Box-\w+-x$/)
    expect(sheet.rules).toEqual([
      `.${name}{color:color-mix(in srgb, var(--c) 12.55%, transparent);}`,
    ])
  })

  it('writes the same class for the same styles and options through either engine', () => {
    const engine = createEngine(theme, { prefix: 'css', hasValueRepair: true })
    const other = createSheetCache('frame')
    const first = engine.withCache(other.cache).css({ color: 'var(--c)20' })
    const second = createEngine(theme, { cache: other.cache, hasValueRepair: true }).css({
      color: 'var(--c)20',
    })
    expect(second).toBe(first)
    expect(other.cache.css({ color: 'var(--c)20' })).not.toBe(first)
  })
})

describe('an entry of another cache', () => {
  it('is written into the cache that is given it, under its own class, and not into the cache that made it', () => {
    const base = createSheetCache('css')
    const other = createSheetCache('frame')
    const entry = base.cache.createEntry({ color: 'red' })
    const name = other.cache.cssIn('overrides', entry)
    expect(name).toMatch(/^frame-/)
    expect(other.sheet.rules.join('')).toContain(`@layer frame-overrides{.${name}{color:red;}}`)
    expect(base.sheet.rules).toEqual([])
    // The same entry again is the same entry of this cache.
    expect(other.cache.adoptEntry(entry)).toBe(other.cache.adoptEntry(entry))
    expect(readEntrySource(other.cache.adoptEntry(entry))?.cache).toBe(other.cache)
  })

  it('is merged by its style with what else is given', () => {
    const base = createSheetCache('css')
    const other = createSheetCache('frame')
    const entry = base.cache.createEntry({ color: 'red' })
    const name = other.cache.css(entry, { margin: 1 })
    expect(other.cache.registered.get(name)).toEqual({ color: 'red', margin: 1 })
  })

  it('is itself when this cache made it, or when it is only a name', () => {
    const { cache } = createSheetCache('frame')
    const own = cache.createEntry({ color: 'red' })
    expect(cache.adoptEntry(own)).toBe(own)
  })
})

describe('adoptSheet', () => {
  it('gives the entries of the engine for a record of entries, once for each record', () => {
    const base = createSheetCache('css')
    const other = createSheetCache('frame')
    const engine = createEngine(theme, { cache: base.cache })
    const derived = engine.withCache(other.cache)
    const sheet = engine.createSheet({ box: { color: 'red' } })
    const adopted = derived.adoptSheet(sheet)
    expect(derived.adoptSheet(sheet)).toBe(adopted)
    expect(Object.keys(adopted)).toEqual(['box'])
    expect(adopted.box.className).toMatch(/^frame-/)
    expect(base.sheet.rules).toEqual([])
    expect(findEntryCache([adopted.box])).toBe(other.cache)
  })
})

describe('findEntryCache', () => {
  it('is the cache of the first entry that a cache made, or undefined', () => {
    const { cache } = createSheetCache('frame')
    const entry = cache.createEntry({ color: 'red' })
    expect(findEntryCache(['name', { color: 'blue' }, entry])).toBe(cache)
    expect(findEntryCache(['name', null])).toBeUndefined()
  })
})

describe('the options of the cache given to an engine with a cache', () => {
  it('are ignored, and warned about once with the development checks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { cache } = createSheetCache('wo')
    createEngine(theme, { cache, hasDevChecks: true, suffix: '-x', hasLayers: false })
    createEngine(theme, { cache, hasDevChecks: true, hasValueRepair: true })
    createEngine(theme, { cache, suffix: '-x' })
    expect(warn.mock.calls).toEqual([
      [
        '[wo] The engine was given a cache and the options suffix, hasLayers, which the cache decides: they are ignored. Give them to createCache, or leave out the cache.',
      ],
    ])
    warn.mockRestore()
  })

  it('include speedy, and an engine warns once in development about hasRuleText, with a cache or without', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', 'development')
    const { cache } = createSheetCache('ws')
    createEngine(theme, { cache, hasDevChecks: true, speedy: true })
    // @ts-expect-error hasRuleText is no option of an engine: it was renamed to speedy.
    createEngine(theme, { prefix: 'wr', hasDevChecks: false, hasRuleText: true })
    vi.unstubAllEnvs()
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[ws] The engine was given a cache and the options speedy, which the cache decides: they are ignored. Give them to createCache, or leave out the cache.',
      '[wr] The option hasRuleText was renamed to speedy, with the opposite meaning: hasRuleText: true is not read, and the default applies. Write speedy: false instead.',
    ])
    warn.mockRestore()
  })
})

describe('the paths of the token options', () => {
  it('are warned about once each when they match no key of the theme, a * standing for any key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const options = {
      prefix: 'tp',
      hasDevChecks: true,
      modes: { 'palette.primry': 'raw', 'palette.*': 'inline', 'space.9': 'raw' },
      registered: { 'palette.accent': true, sizes: true },
      alwaysDeclare: ['palette', 'zIndex'],
    } as const
    createEngine(theme, options)
    createEngine(theme, { ...options, hasDevChecks: false })
    expect(warn.mock.calls.map(([message]) => message)).toEqual(
      [
        ['modes', 'palette.primry'],
        ['modes', 'space.9'],
        ['registered', 'sizes'],
        ['alwaysDeclare', 'zIndex'],
      ].map(
        ([option, path]) =>
          `[tp] The ${option} path "${path}" matches no key of the theme, so it does nothing: check it against the theme.`
      )
    )
    warn.mockRestore()
  })
})
