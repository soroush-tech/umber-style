import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { createSheetEntry } from './sheetEntry'

const theme = { palette: { primary: '#0000ff' } }

function setup(options: { hasLayers?: boolean } = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ hasPruning: false, prefix: 'e', sheet, ...options })
  const engine = createEngine(theme, { prefix: 'e', cache })
  return { engine, sheet, cache }
}

const button = {
  background: 'blue',
  color: 'white',
  '&:hover': { background: 'red' },
}

describe('a styler with layers', () => {
  it('makes one component class when nothing comes from outside, once for static styles', () => {
    const { engine, sheet } = setup()
    const styler = engine.createStyler({ name: 'Button' }, [button])
    const first = styler.getClassName({})
    expect(first.split(' ')).toHaveLength(1)
    expect(first).toMatch(/^e-button-root-[a-z0-9]+$/)
    expect(styler.getClassName({}, [undefined, false, ''])).toBe(first)
    expect(styler.getClassName({}, null)).toBe(first)
    expect(sheet.rules.filter((rule) => rule.includes(`.${first}{`))).toHaveLength(1)
    expect(sheet.rules.at(0)).toBe('@layer e-theme,e-global,e-components,e-overrides;')
  })

  it('puts what comes from outside into one override class that keeps the label', () => {
    const { engine, sheet } = setup()
    const styler = engine.createStyler({ name: 'Button' }, [button])
    const [component, override, ...rest] = styler
      .getClassName({}, [{ background: 'purple' }])
      .split(' ')
    expect(rest).toEqual([])
    expect(component).toMatch(/^e-button-root-/)
    expect(override).toMatch(/^e-button-root-/)
    expect(override).not.toBe(component)
    expect(sheet.rules).toEqual([
      '@layer e-theme,e-global,e-components,e-overrides;',
      `@layer e-components{.${component}{background:blue;color:white;}}`,
      `@layer e-components{.${component}:hover{background:red;}}`,
      `@layer e-overrides{.${override}{background:purple;}}`,
    ])
  })

  it('merges two sheet entries and a plain object into one override class, the last winning', () => {
    const { engine } = setup()
    const sheet = engine.createSheet({
      a: { color: 'red', margin: 1 },
      b: { color: 'green', padding: 2 },
    })
    const { a, b } = sheet.resolve()
    const styler = engine.createStyler({}, [button])
    const classes = styler.getClassName({}, [a, b, { color: 'black' }]).split(' ')
    expect(classes).toHaveLength(2)
    expect(engine.cache.registered.get(classes[1] as string)).toEqual({
      color: 'black',
      margin: 1,
      padding: 2,
    })
  })

  it('resolves engine classes of className into the override class and passes foreign ones through', () => {
    const { engine } = setup()
    const other = engine.createStyler({ name: 'Other' }, [{ margin: 4, color: 'red' }])
    const otherClass = other.getClassName({}, [{ color: 'green' }])
    const styler = engine.createStyler({ name: 'Button' }, [button])
    const classes = styler.getClassName({}, [{ padding: 1 }, `foreign ${otherClass}`]).split(' ')
    expect(classes).toHaveLength(3)
    expect(classes).toContain('foreign')
    const override = classes.at(-1) as string
    expect(engine.cache.registered.get(override)).toMatchObject({
      padding: 1,
      margin: 4,
      color: 'green',
    })
    expect(styler.getClassName({}, 'foreign').split(' ')).toHaveLength(2)
  })

  it('has no override class for a foreign class name or an entry-less extra', () => {
    const { engine } = setup()
    const styler = engine.createStyler({}, [button])
    const own = styler.getClassName({})
    expect(styler.getClassName({}, 'only-foreign')).toBe(`${own} only-foreign`)
    expect(styler.getClassName({}, [{}])).toBe(own)
  })

  it('makes an override class without a label for a component without a name', () => {
    const { engine } = setup()
    const styler = engine.createStyler({}, [button])
    const override = styler.getClassName({}, [{ color: 'red' }]).split(' ')[1]
    expect(override).toMatch(/^e-[a-z0-9]+$/)
  })

  it('computes function styles for the component class and keeps the override class apart', () => {
    const { engine, sheet } = setup()
    const styler = engine.createStyler({ name: 'Box' }, [
      (props: { theme: unknown; tone?: string }) => ({ color: props.tone ?? 'red' }),
    ] as never)
    const red = styler.getClassName({})
    const blue = styler.getClassName({ tone: 'blue' }, [{ margin: 1 }])
    expect(red.split(' ')).toHaveLength(1)
    expect(blue.split(' ')).toHaveLength(2)
    expect(sheet.rules.some((rule) => rule.startsWith('@layer e-components{.e-box-root-'))).toBe(
      true
    )
    expect(sheet.rules.at(-1)).toMatch(
      /^@layer e-overrides\{\.e-box-root-[a-z0-9]+\{margin:1px;\}\}$/
    )
  })

  it('flattens a wrapped component into one component class: inner styles first, then outer', () => {
    const { engine, sheet } = setup()
    const inner = engine.createStyler({ name: 'Button' }, [button])
    const outer = engine.createStyler({ name: 'Primary' }, [{ color: 'gold' }], inner.styles)
    const classes = outer.getClassName({}).split(' ')
    expect(classes).toHaveLength(1)
    const style = engine.cache.registered.get(classes[0] as string)
    expect(style).toMatchObject({ background: 'blue', color: 'gold' })
    expect(sheet.rules.filter((rule) => rule.startsWith('@layer e-overrides'))).toEqual([])
  })

  it('puts a sheet entry on its own, and css and apply, in the components layer', () => {
    const { engine, sheet } = setup()
    const { box } = engine.createSheet({ box: { color: 'red' } }).resolve()
    const css = engine.css({ margin: 2 })
    expect(sheet.rules).toEqual([
      '@layer e-theme,e-global,e-components,e-overrides;',
      `@layer e-components{.${box.className}{color:red;}}`,
      `@layer e-components{.${css}{margin:2px;}}`,
    ])
    expect(createSheetEntry(box.className).className).toBe(box.className)
  })

  it('puts the scope rule and the theme class in the theme layer', () => {
    const { engine, sheet } = setup()
    const scope = engine.scopeClass()
    const themeClass = engine.themeId({ palette: { primary: '#ff0000' } })
    expect(sheet.rules).toEqual([
      '@layer e-theme,e-global,e-components,e-overrides;',
      `@layer e-theme{.${scope}{display:contents;}}`,
      `@layer e-theme{.${themeClass}{--e-palette-primary:#ff0000;}}`,
    ])
  })
})

describe('a styler with hasLayers: false', () => {
  it('merges everything into one class and writes no layer', () => {
    const { engine, sheet, cache } = setup({ hasLayers: false })
    const styler = engine.createStyler({ name: 'Button' }, [button])
    const own = styler.getClassName({})
    const merged = styler.getClassName({}, [{ background: 'purple' }, 'foreign'])
    expect(own.split(' ')).toHaveLength(1)
    expect(merged.split(' ')).toHaveLength(2)
    expect(merged).toMatch(/^foreign e-button-root-[a-z0-9]+$/)
    expect(sheet.rules.join('')).not.toContain('@layer')
    expect(cache.layerOrder).toBe('')
    engine.scopeClass()
    engine.themeId({ palette: { primary: '#ff0000' } })
    expect(sheet.rules.join('')).not.toContain('@layer')
  })

  it('keeps one class for function styles with extras', () => {
    const { engine } = setup({ hasLayers: false })
    const styler = engine.createStyler({}, [() => ({ color: 'red' })] as never)
    expect(styler.getClassName({}, [{ margin: 1 }]).split(' ')).toHaveLength(1)
  })
})
