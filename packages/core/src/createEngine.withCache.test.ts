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
