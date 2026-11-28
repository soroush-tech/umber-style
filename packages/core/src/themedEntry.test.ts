import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { globalStyles } from './globalStyles'
import { createSheetEntry, flattenStyle, isSheetEntry } from './sheetEntry'
import {
  createThemedEntryError,
  createThemedSheet,
  findThemedEntry,
  isThemedEntry,
  readThemedSource,
  rejectThemedEntries,
  THEMED_KEY_PREFIX,
  type ThemedEntry,
} from './themedEntry'

const theme = { palette: { primary: '#0000ff' } }

function setup() {
  const engine = createEngine(theme, {
    prefix: 't',
    cache: createCache({ prefix: 't', sheet: createMemorySheet() }),
  })
  const resolved = engine.createSheet((view) => ({ box: { color: view.palette.primary } }))
  return { engine, resolved }
}

/** A sheet of handles over `{ resolve }`, whose entries are those of the base theme. */
function createSheet(options: { isMerged?: boolean } = {}) {
  const { resolved } = setup()
  const sheet = createThemedSheet(resolved, {
    readEntry: (key) => resolved.resolve()[key as 'box'],
    isMerged: options.isMerged,
  }) as typeof resolved & { box: ThemedEntry; missing: ThemedEntry; [key: string]: unknown }
  return { sheet, resolved }
}

describe('createThemedSheet', () => {
  it('gives a frozen handle for a name, made on first read and kept, that computes nothing', () => {
    const { sheet } = createSheet()
    const handle = sheet.box
    expect(isThemedEntry(handle)).toBe(true)
    expect(isSheetEntry(handle)).toBe(false)
    expect(sheet.box).toBe(handle)
    expect(Object.isFrozen(handle)).toBe(true)
    expect(Object.keys(handle)).toHaveLength(1)
    expect(Object.keys(handle)[0]).toMatch(new RegExp(`^${THEMED_KEY_PREFIX}\\d+\\.box$`))
  })

  it('lets through what the sheet has, what every object has, and what frameworks read', () => {
    const { sheet, resolved } = createSheet()
    expect(sheet.resolve).toBe(resolved.resolve)
    expect(Object.keys(sheet)).toEqual(['resolve'])
    for (const name of ['then', 'toJSON', '$$typeof', '__v_isRef', '__esModule']) {
      expect(sheet[name], name).toBeUndefined()
    }
    expect(sheet.toString).toBe(Object.prototype.toString)
    expect(sheet.constructor).toBe(Object)
    expect(sheet[Symbol.iterator as unknown as string]).toBeUndefined()
    expect(isThemedEntry(sheet)).toBe(false)
  })

  it('reads the entry of the name with the binding, through the source', () => {
    const { sheet, resolved } = createSheet()
    const source = readThemedSource(sheet.box)
    expect(source?.sheet).toBe(sheet)
    expect(source?.key).toBe('box')
    expect(source?.read()).toBe(resolved.resolve().box)
    expect(readThemedSource({})).toBeUndefined()
    expect(() => readThemedSource(sheet.missing)?.read()).toThrow(
      'The sheet has no style named "missing".'
    )
  })

  it('reads nothing where the binding gives no reader (React Native resolves the source itself)', () => {
    const { resolved } = setup()
    const sheet = createThemedSheet(resolved, {}) as unknown as { box: ThemedEntry }
    expect(() => readThemedSource(sheet.box)?.read()).toThrow('no style named "box"')
  })

  it('is a TypeError on a plain element, which reads its key, and as text', () => {
    const { sheet } = createSheet()
    const handle = sheet.box as unknown as Record<string, unknown>
    const [key] = Object.keys(handle)
    expect(() => handle[key]).toThrow(TypeError)
    expect(() => handle[key]).toThrow(/^A plain element: an entry of a sheet made from a function/)
    expect(() => ({ ...handle })).toThrow(TypeError)
    expect(() => String(handle)).toThrow(/^Its text \(a class name\)/)
    expect(() => `${handle as unknown as string}`).toThrow(TypeError)
  })

  it('keeps a key that holds null for a framework that merges style objects, found again by its id', () => {
    const { sheet } = createSheet({ isMerged: true })
    const merged = { ...sheet.box, opacity: 1 }
    const [key] = Object.keys(merged)
    expect(merged).toEqual({ [key]: null, opacity: 1 })
    expect(findThemedEntry(key.slice(THEMED_KEY_PREFIX.length))).toBe(sheet.box)
    expect(findThemedEntry('none')).toBeUndefined()
  })

  it('has no toJSON: a serializer gives its key, with the null of a merged handle', () => {
    const { sheet } = createSheet({ isMerged: true })
    expect('toJSON' in sheet.box).toBe(false)
    expect(JSON.parse(JSON.stringify(sheet.box))).toEqual({ [Object.keys(sheet.box)[0]]: null })
  })
})

describe('a handle where no theme is known', () => {
  it('is a TypeError in a class, among the styles of styled, and in global styles', () => {
    const { engine, resolved } = setup()
    const sheet = createThemedSheet(resolved, { isMerged: true }) as unknown as { box: ThemedEntry }
    expect(() => engine.cache.css(sheet.box as never)).toThrow(
      /^A class \(apply, css\(\), the styles of styled\): an entry of a sheet/
    )
    expect(() => engine.createStyler({}, [sheet.box as never])).toThrow(/^styled\(\): /)
    expect(() => engine.insertGlobal(sheet.box as never)).toThrow(/^Global: /)
    expect(() => engine.insertGlobal(globalStyles({ body: sheet.box as never }))).toThrow(
      /^globalStyles\(\): /
    )
  })
})

describe('rejectThemedEntries', () => {
  it('throws the error of the place for a handle, in lists too, and lets the rest by', () => {
    const { sheet } = createSheet()
    expect(() => rejectThemedEntries([{ color: 'red' }, null, 'a'], 'apply()')).not.toThrow()
    expect(() => rejectThemedEntries([[false, [sheet.box]]], 'apply()')).toThrow(
      createThemedEntryError('apply()').message
    )
  })

  it('says what resolves a handle instead', () => {
    expect(createThemedEntryError('css()').message).toBe(
      'css(): an entry of a sheet made from a function of the theme (StyleSheet.create((theme) => ...)) has no theme here. Give it to the style prop of a styled component, which resolves it with its theme, or read the entry from useStyle(sheet) first.'
    )
  })
})

describe('flattenStyle with handles', () => {
  it('reads the entry of a handle for a styled component, alone, in lists and merged by its key', () => {
    const { sheet, resolved } = createSheet({ isMerged: true })
    const { engine } = setup()
    const box = resolved.resolve().box
    expect(flattenStyle(sheet.box, undefined, engine.cache)).toEqual([box])
    expect(flattenStyle([false, [sheet.box, { opacity: 1 }]], undefined, engine.cache)).toEqual([
      box,
      { opacity: 1 },
    ])
    // Merged by its key (Vue), it is found again where the binding finds merged entries.
    expect(
      flattenStyle({ ...sheet.box, opacity: 1 }, engine.cache.findEntry, engine.cache)
    ).toEqual([box, { opacity: 1 }])
  })

  it('is the TypeError of css() where there is no component', () => {
    const { sheet } = createSheet({ isMerged: true })
    const { engine } = setup()
    expect(() => flattenStyle([sheet.box])).toThrow(/^css\(\): an entry of a sheet/)
    expect(() => flattenStyle({ ...sheet.box }, engine.cache.findEntry)).toThrow(
      /^css\(\): an entry of a sheet/
    )
  })
})

describe('what a server component passing a style to a client component leaves of it', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('warns once for each key in development, in a styled component that does not merge style objects', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { engine } = setup()
    const entry = { '--umber-entry-t-left1': null }
    const handle = { '--umber-themed-9.left': null }
    const flat = flattenStyle([entry, entry, handle, [handle]], undefined, engine.cache)
    expect(flat.map(String)).toEqual(['t-left1', 't-left1'])
    expect(warn.mock.calls).toEqual([
      [
        '[t] A style was passed from a server component to a client component (--umber-entry-t-left1), and its CSS cannot cross: import the sheet in the client component, and pass a plain value such as a string to choose the style.',
      ],
      [
        '[t] A style was passed from a server component to a client component (--umber-themed-9.left), and its CSS cannot cross: import the sheet in the client component, and pass a plain value such as a string to choose the style.',
      ],
    ])
  })

  it('says nothing in production, for an entry or a spread copy of one, for an object of several keys, nor where style objects merge', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { engine } = setup()
    flattenStyle({ '--umber-entry-t-left2': null }, undefined, engine.cache)
    vi.stubEnv('NODE_ENV', 'development')
    const copy = { ...createSheetEntry('t-left3') }
    flattenStyle([copy, { '--umber-entry-t-left4': null, opacity: 1 }], undefined, engine.cache)
    flattenStyle({ '--umber-entry-t-left5': null }, engine.cache.findEntry, engine.cache)
    flattenStyle({ '--umber-themed-9.other': null, opacity: 1 }, undefined, engine.cache)
    expect(warn).not.toHaveBeenCalled()
  })
})
