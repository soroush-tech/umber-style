import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { isSheetEntry } from './sheetEntry'

const theme = {
  palette: { primary: '#0000ff', text: '#111111' },
  space: [0, 4, 8],
  breakpoints: { md: 768 },
}

function setup(prefix = 'e') {
  const sheet = createMemorySheet()
  const engine = createEngine(theme, { prefix, cache: createCache({ prefix, sheet }) })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  return { engine, sheet, ruleOf }
}

describe('createEngine', () => {
  it('holds the cache, the references of the theme and css', () => {
    const { engine, ruleOf } = setup()
    expect(engine.refs.palette.primary).toBe('var(--e-palette-primary)')
    expect(engine.refs.space[1]).toBe('var(--e-space-1)')
    expect(engine.refs.breakpoints.md).toBe(768)
    const className = engine.css({ color: engine.refs.palette.primary })
    expect(ruleOf(className)).toBe(`.${className}{color:var(--e-palette-primary);}`)
    expect(engine.cache.registered.has(className)).toBe(true)
  })

  it('makes its own cache from the options, with the prefix of a given cache first', () => {
    expect(createEngine(theme).cache.prefix).toBe('css')
    const own = createEngine(theme, { prefix: 'my', suffix: '-s', hasLabels: false })
    expect(own.css({ label: 'x', color: 'red' })).toMatch(/^my-[a-z0-9]+-s$/)
    const cache = createCache({ prefix: 'given', sheet: createMemorySheet() })
    const shared = createEngine(theme, { cache })
    expect(shared.cache).toBe(cache)
    expect(shared.themeClass({})).toMatch(/^given-theme-/)
  })

  it('makes one class for a theme object and color scheme, once', () => {
    const { engine, sheet } = setup()
    const partial = { palette: { primary: '#ff0000' } }
    const first = engine.themeClass(partial)
    expect(engine.themeClass(partial)).toBe(first)
    const dark = engine.themeClass(partial, 'dark')
    expect(dark).not.toBe(first)
    expect(engine.themeClass(partial, 'dark')).toBe(dark)
    expect(sheet.rules.filter((rule) => rule.startsWith('.e-theme-'))).toHaveLength(2)
    expect(sheet.rules).toContain(`.${first}{--e-palette-primary:#ff0000;}`)
  })

  it('makes the classes of a sheet on first use, and only once', () => {
    const { engine, sheet, ruleOf } = setup()
    const make = vi.fn((refs: typeof theme) => ({ box: { color: refs.palette.primary } }))
    const created = engine.createSheet(make)
    expect(sheet.rules).toHaveLength(0)
    const { box } = created.resolve()
    expect(isSheetEntry(box)).toBe(true)
    expect(created.resolve()).toEqual({ box })
    expect(make).toHaveBeenCalledTimes(1)
    expect(ruleOf(box.className)).toBe(`.${box.className}{color:var(--e-palette-primary);}`)
    expect(engine.createSheet({ a: { margin: 1 } }).resolve().a.className).toMatch(/^e-/)
  })
})

describe('createStyler', () => {
  it('labels the class: name, kebab case, and a slot', () => {
    const { engine } = setup()
    expect(engine.createStyler({ name: 'Button' }, [{ color: 'red' }]).getClassName({})).toMatch(
      /^e-button-root-/
    )
    const slot = engine.createStyler({ name: 'IconButton', slot: 'startIcon' }, [{ color: 'red' }])
    expect(slot.getClassName({})).toMatch(/^e-icon-button-start-icon-/)
    expect(engine.createStyler({}, [{ color: 'red' }]).getClassName({})).toMatch(/^e-[a-z0-9]+$/)
  })

  it('keeps the inherited styles first in its list', () => {
    const { engine, ruleOf } = setup()
    const inner = engine.createStyler({ name: 'Base' }, [{ color: 'red' }])
    const outer = engine.createStyler({ name: 'Fancy' }, [{ margin: 4 }], inner.styles)
    expect(outer.styles).toEqual([
      { label: 'base-root' },
      { color: 'red' },
      { label: 'fancy-root' },
      { margin: 4 },
    ])
    const className = outer.getClassName({})
    expect(className).toMatch(/^e-fancy-root-/)
    expect(ruleOf(className)).toBe(`.${className}{color:red;margin:4px;}`)
  })

  it('calls a function style with the props and the references', () => {
    const { engine, ruleOf } = setup()
    const styler = engine.createStyler({}, [
      ({ tone, theme: refs }: { tone: string; theme: typeof theme }) => ({
        color: tone === 'a' ? refs.palette.primary : refs.palette.text,
      }),
      () => false,
    ])
    const a = styler.getClassName({ tone: 'a' })
    expect(styler.getClassName({ tone: 'a' })).toBe(a)
    const b = styler.getClassName({ tone: 'b' })
    expect(b).not.toBe(a)
    expect(ruleOf(a)).toBe(`.${a}{color:var(--e-palette-primary);}`)
  })

  it('keeps object styles next to function styles', () => {
    const { engine, ruleOf } = setup()
    const styler = engine.createStyler({}, [{ margin: 4 }, () => ({ color: 'red' })])
    const className = styler.getClassName({})
    expect(ruleOf(className)).toBe(`.${className}{margin:4px;color:red;}`)
  })

  it('computes a class once without function styles, and merges a given className last', () => {
    const { engine, ruleOf } = setup()
    const spy = vi.spyOn(engine.cache, 'css')
    const styler = engine.createStyler({}, [{ color: 'red', margin: 4 }])
    const first = styler.getClassName({})
    expect(styler.getClassName({})).toBe(first)
    expect(spy).toHaveBeenCalledTimes(1)
    const given = engine.css({ color: 'blue' })
    const merged = styler.getClassName({}, `${given} external`)
    const [external, engineClass] = merged.split(' ')
    expect(external).toBe('external')
    expect(ruleOf(engineClass)).toBe(`.${engineClass}{margin:4px;color:blue;}`)
  })
})

describe('sheet entries in classes', () => {
  it('merges entries and class names in order, with a later one winning', () => {
    const { engine, ruleOf } = setup()
    const { a, b } = engine
      .createSheet({ a: { color: 'red', margin: 1 }, b: { color: 'blue' } })
      .resolve()
    const merged = engine.css(a, b)
    expect(ruleOf(merged)).toBe(`.${merged}{margin:1px;color:blue;}`)
    expect(engine.css(a.className, b)).toBe(merged)
  })

  it('puts entries after the styles of a styler and before a class name', () => {
    const { engine, ruleOf } = setup()
    const { a } = engine.createSheet({ a: { color: 'green' } }).resolve()
    const styler = engine.createStyler({}, [{ color: 'red', margin: 4 }])
    const className = styler.getClassName({}, [a, false, 'external'])
    const [external, engineClass] = className.split(' ')
    expect(external).toBe('external')
    expect(ruleOf(engineClass)).toBe(`.${engineClass}{margin:4px;color:green;}`)
    const dynamic = engine.createStyler({}, [() => ({ margin: 4 })])
    expect(ruleOf(dynamic.getClassName({}, a))).toContain('margin:4px;color:green;')
  })

  it('makes no class for a style with no declaration', () => {
    const { engine, sheet } = setup()
    expect(engine.css({})).toBe('')
    expect(engine.css({ label: 'x' }, 'external')).toBe('external')
    expect(engine.createStyler({ name: 'Empty' }, []).getClassName({})).toBe('')
    expect(sheet.rules).toHaveLength(0)
  })
})

describe('scopeClass', () => {
  it('is one class with display: contents, inserted once, apart from the theme classes', () => {
    const { engine, sheet } = setup()
    const className = engine.scopeClass()
    expect(className).toBe('e-scope')
    expect(engine.scopeClass()).toBe(className)
    expect(sheet.rules).toEqual(['.e-scope{display:contents;}'])
    expect(engine.cache.getRules(className)).toEqual(['.e-scope{display:contents;}'])
    expect(engine.themeClass({ palette: { primary: '#fff' } })).not.toBe(className)
    expect(sheet.rules.at(-1)).not.toContain('display')
  })
})
