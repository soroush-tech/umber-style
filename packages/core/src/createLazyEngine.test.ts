import { createCache, createMemorySheet } from './cache'
import { createEngine, createLazyEngine, NO_THEME_MESSAGE } from './createEngine'

const light = { palette: { primary: '#0000ff' }, space: [0, 4] }
const other = { palette: { primary: '#ff0000', accent: '#00ff00' }, space: [0, 8] }

function setup() {
  const sheet = createMemorySheet()
  const engine = createLazyEngine<typeof light>({
    prefix: 'l',
    cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'l', sheet }),
  })
  return { engine, sheet }
}

describe('createLazyEngine without a theme', () => {
  it('has no theme and says so', () => {
    const { engine } = setup()
    expect(engine.hasTheme).toBe(false)
    expect(engine.baseTheme).toBeUndefined()
    expect(() => engine.refs).toThrow(NO_THEME_MESSAGE)
    expect(NO_THEME_MESSAGE).toContain('ThemeProvider')
    expect(NO_THEME_MESSAGE).toContain('setTheme')
  })

  it('works for what needs no shape: css, object styles and object sheets', () => {
    const { engine } = setup()
    expect(engine.css({ color: 'red' })).toMatch(/^l-/)
    expect(engine.createStyler({}, [{ color: 'red' }]).getClassName({})).toMatch(/^l-/)
    expect(engine.createSheet({ a: { margin: 1 } }).resolve().a.className).toMatch(/^l-/)
  })

  it('throws one clear error for a function style or a function sheet', () => {
    const { engine } = setup()
    const styler = engine.createStyler({}, [({ theme }: { theme: typeof light }) => theme])
    expect(() => styler.getClassName({})).toThrow(NO_THEME_MESSAGE)
    const created = engine.createSheet((theme) => ({ a: { color: theme.palette.primary } }))
    expect(() => created.resolve()).toThrow(NO_THEME_MESSAGE)
  })

  it('lets a styler made before the theme work once there is one', () => {
    const { engine, sheet } = setup()
    const styler = engine.createStyler({ name: 'Box' }, [
      ({ theme }: { theme: typeof light }) => ({ color: theme.palette.primary }),
    ])
    engine.setTheme(light)
    const className = styler.getClassName({})
    expect(className).toMatch(/^l-box-root-/)
    expect(sheet.rules).toContain(`.${className}{color:var(--l-palette-primary);}`)
  })

  it('takes the first theme it is given a class for as its base, and keeps it', () => {
    const { engine } = setup()
    const first = engine.themeClass(light)
    expect(engine.hasTheme).toBe(true)
    expect(engine.baseTheme).toBe(light)
    engine.themeClass(other as unknown as typeof light)
    expect(engine.baseTheme).toBe(light)
    expect(engine.themeClass(light)).toBe(first)
  })

  it('makes the base from a partial theme, whose shape then lacks the other tokens', () => {
    const { engine } = setup()
    const partial = { palette: { primary: '#123456' } }
    engine.themeClass(partial as typeof light)
    expect(engine.refs.palette.primary).toBe('var(--l-palette-primary)')
    expect(engine.refs.space).toBeUndefined()
  })
})

describe('setTheme', () => {
  it('does nothing for the same object', () => {
    const { engine } = setup()
    engine.setTheme(light)
    const make = vi.fn((theme: typeof light) => ({ a: { color: theme.palette.primary } }))
    const created = engine.createSheet(make)
    created.resolve()
    const { refs } = engine
    engine.setTheme(light)
    created.resolve()
    expect(make).toHaveBeenCalledTimes(1)
    expect(engine.refs).toBe(refs)
  })

  it('replaces the base: the shape changes, function sheets are made again, other classes stay', () => {
    const { engine, sheet } = setup()
    engine.setTheme(light as typeof light)
    const make = vi.fn((theme: typeof other) => ({ a: { color: theme.palette.accent ?? 'x' } }))
    const created = engine.createSheet(make as never)
    const objectSheet = engine.createSheet({ b: { margin: 1 } })
    const styler = engine.createStyler({}, [{ margin: 2 }])
    const themeClassBefore = engine.themeClass(light)
    const staticBefore = styler.getClassName({})
    const objectBefore = objectSheet.resolve()
    const before = created.resolve()
    expect(make).toHaveBeenCalledTimes(1)

    engine.setTheme(other as unknown as typeof light)
    expect(engine.baseTheme).toBe(other)
    expect((engine.refs as unknown as typeof other).palette.accent).toBe('var(--l-palette-accent)')
    const after = created.resolve()
    expect(make).toHaveBeenCalledTimes(2)
    expect(after).not.toBe(before)
    expect(created.resolve()).toBe(after)
    expect(objectSheet.resolve()).toBe(objectBefore)
    expect(styler.getClassName({})).toBe(staticBefore)
    expect(engine.themeClass(light)).toBe(themeClassBefore)
    expect(sheet.rules.filter((rule) => rule.startsWith('.l-theme-'))).toHaveLength(1)
  })

  it('createEngine with a theme has it from the start', () => {
    const engine = createEngine(light, { prefix: 'c', hasLayers: false })
    expect(engine.hasTheme).toBe(true)
    expect(engine.baseTheme).toBe(light)
  })
})
