import { createCache, createDomSheet, createMemorySheet, type CacheOptions } from './cache'
import { createStyleTag } from './extractStyles'
import { createEngine, createLazyEngine, isThemedSheet } from './createEngine'
import { createSheetEntry, flattenStyle, isSheetEntry, readEntrySource } from './sheetEntry'

const theme = { palette: { primary: '#0000ff' } }

function setup(options: CacheOptions = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ hasPruning: false, prefix: 'e', sheet, ...options })
  const engine = createEngine(theme, { prefix: 'e', cache })
  const rulesIn = (layer: string) =>
    sheet.rules.filter((rule) => rule.startsWith(`@layer e-${layer}{`))
  return { engine, sheet, cache, rulesIn }
}

describe('an object sheet', () => {
  it('is its entries, made on first access, and writes nothing until an entry is used', () => {
    const { engine, sheet } = setup()
    const styles = engine.createSheet({ box: { color: 'red' }, text: { margin: 1 } })
    expect(Object.keys(styles)).toEqual(['box', 'text'])
    expect(isThemedSheet(styles)).toBe(false)
    expect(isSheetEntry(styles.box)).toBe(true)
    expect(styles.box).toBe(styles.box)
    expect(sheet.rules).toEqual([])
    expect(readEntrySource(styles.box)?.style).toEqual({ color: 'red' })
  })

  it('works before there is a theme: no theme is read, and no setTheme is needed', () => {
    const sheet = createMemorySheet()
    const engine = createLazyEngine({ prefix: 'n', cache: createCache({ prefix: 'n', sheet }) })
    expect(engine.hasTheme).toBe(false)
    const styles = engine.createSheet({ box: { color: 'red' } })
    expect(engine.css(styles.box)).toMatch(/^n-/)
    const styler = engine.createStyler({ name: 'View' }, [{ margin: 1 }])
    expect(styler.getClassName({}, styles.box).split(' ')).toHaveLength(2)
    expect(engine.hasTheme).toBe(false)
  })

  it('spreads into its entries, and a key that is called resolve is an entry like any other', () => {
    const { engine } = setup()
    const styles = engine.createSheet({ resolve: { color: 'red' } })
    expect(isThemedSheet(styles)).toBe(false)
    expect(Object.keys({ ...styles })).toEqual(['resolve'])
  })

  it('is told from a sheet made from a function of the theme, which has no entries', () => {
    const { engine } = setup()
    const themed = engine.createSheet((refs) => ({ box: { color: refs.palette.primary } }))
    expect(isThemedSheet(themed)).toBe(true)
    expect(Object.keys(themed)).toEqual(['resolve'])
    expect(isSheetEntry(themed.resolve().box)).toBe(true)
  })
})

describe('an entry is written when it is used, in the layer of how it is used', () => {
  it('writes the components rule when it is read as a class, and only once', () => {
    const { engine, rulesIn } = setup()
    const { box } = engine.createSheet({ box: { color: 'red' } })
    const { className } = box
    expect(`${box}`).toBe(className)
    expect(engine.css(box)).toBe(className)
    expect(engine.cache.cssIn('components', box)).toBe(className)
    expect(rulesIn('components')).toEqual([`@layer e-components{.${className}{color:red;}}`])
    expect(rulesIn('overrides')).toEqual([])
  })

  it('writes one overrides rule, and no components rule, for an entry that is only given through style', () => {
    const { engine, rulesIn } = setup()
    const { box } = engine.createSheet({ box: { color: 'red' } })
    const styler = engine.createStyler({ name: 'Button' }, [{ background: 'blue' }])
    const [own, override, ...rest] = styler.getClassName({}, [box]).split(' ')
    expect(rest).toEqual([])
    expect(override).toMatch(/^e-[a-z0-9]+$/)
    expect(rulesIn('overrides')).toEqual([`@layer e-overrides{.${override}{color:red;}}`])
    expect(rulesIn('components')).toEqual([`@layer e-components{.${own}{background:blue;}}`])
  })

  it('gives the same class to two components, and writes it once', () => {
    const { engine, rulesIn } = setup()
    const { box } = engine.createSheet({ box: { color: 'red' } })
    const one = engine.createStyler({ name: 'One' }, [{ margin: 1 }])
    const two = engine.createStyler({ name: 'Two' }, [{ margin: 2 }])
    const a = one.getClassName({}, [box]).split(' ')[1]
    const b = two.getClassName({}, [box]).split(' ')[1]
    expect(a).toBe(b)
    expect(rulesIn('overrides')).toHaveLength(1)
  })

  it('writes one rule for each role when an entry is used both ways, in two classes', () => {
    const { engine, rulesIn } = setup()
    const { box } = engine.createSheet({ box: { color: 'red' } })
    const styler = engine.createStyler({}, [{ margin: 1 }])
    const override = styler.getClassName({}, [box]).split(' ')[1]
    const own = engine.css(box)
    expect(own).not.toBe(override)
    expect(rulesIn('components')).toContain(`@layer e-components{.${own}{color:red;}}`)
    expect(rulesIn('overrides')).toEqual([`@layer e-overrides{.${override}{color:red;}}`])
    expect(engine.cache.registered.get(own)).toEqual({ color: 'red' })
    expect(engine.cache.registered.get(override)).toEqual({ color: 'red' })
  })

  it('keeps foreign class names in front of the entry class', () => {
    const { engine } = setup()
    const { box } = engine.createSheet({ box: { color: 'red' } })
    const styler = engine.createStyler({}, [{ margin: 1 }])
    const [own, foreign, override] = styler.getClassName({}, [box, 'foreign']).split(' ')
    expect(foreign).toBe('foreign')
    expect(own).not.toBe(override)
    expect(engine.cache.getRules(override)).toEqual([
      `@layer e-overrides{.${override}{color:red;}}`,
    ])
  })

  it('writes no class for an entry with no declaration', () => {
    const { engine, sheet } = setup()
    const { empty } = engine.createSheet({ empty: { label: 'x' } })
    expect(empty.className).toBe('')
    expect(engine.css(empty)).toBe('')
    expect(
      engine
        .createStyler({}, [{ margin: 1 }])
        .getClassName({}, [empty])
        .split(' ')
    ).toHaveLength(1)
    expect(sheet.rules.filter((rule) => rule.includes('empty'))).toEqual([])
  })
})

describe('what is merged, as before, into one override class', () => {
  it('merges two entries, an entry and a plain object, an entry given twice, and an engine class', () => {
    const { engine, rulesIn } = setup()
    const { a, b } = engine.createSheet({ a: { color: 'red', margin: 1 }, b: { color: 'blue' } })
    const styler = engine.createStyler({ name: 'Box' }, [{ padding: 1 }])
    const classOf = (...extras: unknown[]) => styler.getClassName({}, extras as never).split(' ')[1]
    const ab = classOf(a, b)
    expect(engine.cache.registered.get(ab)).toMatchObject({ color: 'blue', margin: 1 })
    expect(ab).toMatch(/^e-box-root-/)
    expect(classOf(a, { opacity: 1 })).toMatch(/^e-box-root-/)
    expect(classOf(a, false, a)).toMatch(/^e-box-root-/)
    expect(classOf(engine.css({ margin: 3 }))).toMatch(/^e-box-root-/)
    expect(classOf(a.className)).toMatch(/^e-box-root-/)
    expect(rulesIn('overrides').length).toBeGreaterThan(1)
  })

  it('is not used as it is without layers: it joins the styles of the component in one class', () => {
    const { engine } = setup({ hasLayers: false })
    const { a } = engine.createSheet({ a: { color: 'red' } })
    const styler = engine.createStyler({}, [{ margin: 1 }])
    const className = styler.getClassName({}, [a])
    expect(className.split(' ')).toHaveLength(1)
    expect(engine.cache.registered.get(className)).toEqual({ margin: 1, color: 'red' })
    expect(engine.cache.cssIn('overrides', a)).toBe(a.className)
  })

  it('is merged into a class that is made after another class, never used as it is', () => {
    const { engine } = setup()
    const { a } = engine.createSheet({ a: { color: 'red' } })
    const own = engine.css({ margin: 1 })
    const after = engine.cache.cssWith({ after: own }, a)
    expect(after).not.toBe(a.className)
    expect(engine.cache.registered.get(after)).toEqual({ color: 'red' })
  })
})

describe('an entry that a framework merged with others', () => {
  it('is found again by its class name, with what it needs to be written', () => {
    const { engine, cache } = setup()
    const { a, b } = engine.createSheet({ a: { color: 'red' }, b: { margin: 1 } })
    const merged = { ...a, ...b, opacity: 1 }
    const flat = flattenStyle(merged, cache.findEntry)
    expect(flat).toHaveLength(3)
    expect(flat[0]).toBe(a)
    expect(flat[1]).toBe(b)
    expect(flat[2]).toEqual({ opacity: 1 })
    expect(cache.findEntry('nothing')).toBeUndefined()
  })
})

describe('createSheetEntry with a source', () => {
  it('reads its class name through the source, so that it is written when it is read', () => {
    const use = vi.fn(() => 'used')
    const { cache } = setup()
    const entry = createSheetEntry('named', { style: { color: 'red' }, cache, use })
    expect(use).not.toHaveBeenCalled()
    expect(entry.className).toBe('used')
    expect(`${entry}`).toBe('used')
    expect(use).toHaveBeenCalledWith('components')
    expect(Object.keys(entry)).toEqual(['--umber-entry-named'])
    expect(readEntrySource(entry)?.style).toEqual({ color: 'red' })
    expect(readEntrySource(createSheetEntry('bare'))).toBeUndefined()
  })
})

describe('an entry the server already sent', () => {
  it('is not written again by a cache that read its ids from the style element', () => {
    const server = setup()
    const names = server.engine.createSheet({ box: { color: 'red' } })
    const serverStyler = server.engine.createStyler({}, [{ margin: 1 }])
    const served = serverStyler.getClassName({}, [names.box])
    document.head.innerHTML = createStyleTag(server.cache)
    const client = createCache({ hasPruning: false, prefix: 'e', sheet: createDomSheet('e') })
    const engine = createEngine(theme, { prefix: 'e', cache: client })
    const { box } = engine.createSheet({ box: { color: 'red' } })
    const before = document.querySelector('style')?.sheet?.cssRules.length ?? 0
    const clientStyler = engine.createStyler({}, [{ margin: 1 }])
    expect(clientStyler.getClassName({}, [box])).toBe(served)
    expect(document.querySelector('style')?.sheet?.cssRules.length ?? 0).toBe(before)
    expect(client.registered.has(served.split(' ')[1])).toBe(true)
    document.head.innerHTML = ''
  })
})

describe('an entry that is only a name', () => {
  it('passes through as a class name, or resolves back to the style the cache made for it', () => {
    const { engine } = setup()
    expect(engine.css(createSheetEntry('outside'))).toBe('outside')
    const made = engine.css({ color: 'red' })
    expect(engine.css(createSheetEntry(made), { margin: 1 })).not.toBe(made)
    expect(engine.cache.registered.get(engine.css(createSheetEntry(made)))).toEqual({
      color: 'red',
    })
  })

  it('is what flattenStyle makes of a merged key that no cache knows', () => {
    const [entry] = flattenStyle({ ...createSheetEntry('lost') })
    expect(isSheetEntry(entry)).toBe(true)
    expect(readEntrySource(entry as never)).toBeUndefined()
  })

  it('keeps an entry that has a source whole, in a list', () => {
    const { engine } = setup()
    const { a } = engine.createSheet({ a: { color: 'red' } })
    expect(flattenStyle([a, [a]])).toEqual([a, a])
    expect(flattenStyle([a])[0]).toBe(a)
  })
})
