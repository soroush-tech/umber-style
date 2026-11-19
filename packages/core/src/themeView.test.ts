import { at } from './at'
import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'

const theme = {
  palette: { primary: '#0000ff' },
  space: [0, 4],
  breakpoints: ['600px'],
  components: { Button: { size: 'small' } },
  format: (value: number) => `${value}px`,
  isDense: false,
}

function setup() {
  const sheet = createMemorySheet()
  const engine = createEngine(theme, {
    prefix: 'v',
    cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'v', sheet }),
  })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  return { engine, sheet, ruleOf }
}

describe('createThemeView', () => {
  it('has references for tokens and the real value for every other part', () => {
    const { engine } = setup()
    const nested = { ...theme, breakpoints: ['300px'], format: () => 'x', isDense: true }
    const view = engine.createThemeView(nested)
    expect(view.palette.primary).toBe('var(--v-palette-primary)')
    expect(view.space[1]).toBe('var(--v-space-1)')
    expect(view.breakpoints).toEqual(['300px'])
    expect(view.components).toBe(nested.components)
    expect(view.format).toBe(nested.format)
    expect(view.isDense).toBe(true)
  })

  it('is made once for a theme object, and the base view is the refs', () => {
    const { engine } = setup()
    const other = { ...theme }
    expect(engine.createThemeView(other)).toBe(engine.createThemeView(other))
    expect(engine.createThemeView(other)).not.toBe(engine.createThemeView({ ...theme }))
    expect(engine.createThemeView(theme)).toBe(engine.createThemeView(theme))
    expect(engine.refs.breakpoints).toBe(theme.breakpoints)
  })
})

describe('a view given to a styler', () => {
  it('reaches function styles, so the class depends on the raw values and not on tokens', () => {
    const { engine, ruleOf } = setup()
    const styler = engine.createStyler({}, [
      ({ theme: view }: { theme: typeof theme }) => ({
        color: view.palette.primary,
        ...at(`@media (width >= ${view.breakpoints[0]})`, { padding: view.space[1] }),
      }),
    ])
    expect(styler.isDynamic).toBe(true)
    expect(engine.createStyler({}, [{ color: 'red' }]).isDynamic).toBe(false)
    const outer = styler.getClassName({})
    const same = styler.getClassName({}, undefined, engine.createThemeView({ ...theme }))
    const nested = styler.getClassName(
      {},
      undefined,
      engine.createThemeView({ ...theme, breakpoints: ['300px'] })
    )
    expect(same).toBe(outer)
    expect(nested).not.toBe(outer)
    expect(ruleOf(nested)).toBe(`.${nested}{color:var(--v-palette-primary);}`)
  })
})

describe('a sheet resolved against a view', () => {
  it('is made once for each view, and against the base without one', () => {
    const { engine } = setup()
    const make = vi.fn((view: typeof theme) => ({ box: { margin: view.breakpoints[0] } }))
    const created = engine.createSheet(make)
    expect(created.isDynamic).toBe(true)
    const view = engine.createThemeView({ ...theme, breakpoints: ['300px'] })
    const first = created.resolve(view)
    expect(created.resolve(view)).toBe(first)
    expect(make).toHaveBeenCalledTimes(1)
    expect(created.resolve()).not.toBe(first)
    expect(make).toHaveBeenCalledTimes(2)
    const fixed = engine.createSheet({ a: { margin: 1 } })
    expect(fixed.isDynamic).toBe(false)
    expect(fixed.resolve(view)).toBe(fixed.resolve())
  })
})

describe('cache.getRules', () => {
  it('returns the rules of a class and of a theme class, and none for another name', () => {
    const { engine, ruleOf } = setup()
    const className = engine.css({ color: 'red', '&:hover': { color: 'blue' } })
    expect(engine.cache.getRules(className)).toEqual([
      ruleOf(className),
      `.${className}:hover{color:blue;}`,
    ])
    const themeClass = engine.themeId({ palette: { primary: '#fff' } })
    expect(engine.cache.getRules(themeClass)).toEqual([`.${themeClass}{--v-palette-primary:#fff;}`])
    expect(engine.cache.getRules('external')).toEqual([])
  })
})
