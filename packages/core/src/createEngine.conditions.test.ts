import { createCache, createDomSheet, createMemorySheet } from './cache'
import { createEngine } from './createEngine'

const base = { palette: { primary: '#0000ff', surface: '#ffffff' } }
const dark = { palette: { primary: '#8888ff', surface: '#111111' } }
const other = { palette: { primary: '#00ff00', surface: '#eeeeee' } }

function setup(options: { hasScope?: boolean; hasLayers?: boolean; hasPruning?: boolean } = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 'e', sheet, ...options })
  const engine = createEngine(base, { prefix: 'e', cache })
  return { engine, sheet, cache }
}

describe('the theme class string', () => {
  it('is the theme class and the boundary marker, with a scheme marker for light or dark', () => {
    const { engine } = setup()
    const id = engine.themeId(dark)
    expect(id).toMatch(/^e-theme-[a-z0-9]+$/)
    expect(engine.themeClass(dark)).toBe(`${id} e-boundary`)
    const darkId = engine.themeId(dark, 'dark')
    expect(engine.themeClass(dark, 'dark')).toBe(`${darkId} e-boundary e-scheme-dark`)
    const lightId = engine.themeId(base, 'light')
    expect(engine.themeClass(base, 'light')).toBe(`${lightId} e-boundary e-scheme-light`)
    const bothId = engine.themeId(base, 'light dark')
    expect(engine.themeClass(base, 'light dark')).toBe(`${bothId} e-boundary`)
  })

  it('keeps the rule of a theme under the theme class alone', () => {
    const { engine, cache } = setup({ hasPruning: false })
    const id = engine.themeId(dark)
    expect(cache.getRules(id)).toEqual([
      `@layer e-theme{.${id}{--e-palette-primary:#8888ff;--e-palette-surface:#111111;}}`,
    ])
    expect(cache.getRules(engine.themeClass(dark))).toEqual([])
  })
})

describe('when()', () => {
  it('is a key that names the theme class, and makes the theme rule', () => {
    const { engine, cache } = setup({ hasPruning: false })
    const key = engine.when(dark)
    expect(key).toBe(`@theme ${engine.themeId(dark)}`)
    expect(cache.getRules(engine.themeId(dark))).toHaveLength(1)
    expect(engine.when(dark, 'dark')).toBe(`@theme ${engine.themeId(dark, 'dark')}`)
    expect(engine.whenScheme('dark')).toBe('@scheme dark')
  })

  it('puts the conditional rules of a component in the components layer, after its base rule', () => {
    const { engine, sheet } = setup()
    const card = engine.css({
      border: 'none',
      [engine.when(dark)]: { border: '1px solid white' },
      [engine.whenScheme('dark')]: { boxShadow: 'none' },
    })
    const id = engine.themeId(dark)
    const rules = sheet.rules.filter((rule) => rule.includes(card))
    const guard = ':where(:not(.e-scheme-light,.e-scheme-dark,.e-scheme-light *,.e-scheme-dark *))'
    expect(rules).toEqual([
      `@layer e-components{.${card}{border:none;}}`,
      `@layer e-components{@scope (.${id}) to (.e-boundary){.${card}{border:1px solid white;}}}`,
      `@layer e-components{@scope (.e-scheme-dark) to (.e-scheme-light,.e-scheme-dark){.${card}{box-shadow:none;}}}`,
      `@layer e-components{@media (prefers-color-scheme: dark){.${card}${guard}{box-shadow:none;}}}`,
    ])
  })

  it('puts the conditional rules of a style given from outside in the overrides layer', () => {
    const { engine, sheet } = setup()
    const styler = engine.createStyler({ name: 'Card' }, [{ color: 'red' }])
    const [, override] = styler
      .getClassName({}, [{ [engine.when(dark)]: { color: 'blue' } }])
      .split(' ')
    expect(sheet.rules.filter((rule) => rule.includes(override))).toEqual([
      `@layer e-overrides{@scope (.${engine.themeId(dark)}) to (.e-boundary){.${override}{color:blue;}}}`,
    ])
  })

  it('writes the descendant form with hasScope false, and says so in the cache', () => {
    const { engine, sheet, cache } = setup({ hasScope: false, hasLayers: false })
    expect(cache.hasScope).toBe(false)
    const card = engine.css({ [engine.when(dark)]: { border: '1px solid white' } })
    expect(sheet.rules).toContain(
      `:where(.${engine.themeId(dark)}) .${card}{border:1px solid white;}`
    )
    expect(setup().cache.hasScope).toBe(true)
  })

  it('takes the option from the engine, which makes its cache', () => {
    const engine = createEngine(base, { prefix: 'e', hasScope: false })
    expect(engine.cache.hasScope).toBe(false)
  })

  it('marks the tokens used inside conditional rules as used, so a pruned theme declares them', () => {
    const { engine, sheet } = setup()
    const key = engine.when(dark)
    expect(sheet.rules.join('')).not.toContain('--e-palette-surface')
    engine.css({ [key]: { background: engine.refs.palette.surface } })
    const id = engine.themeId(dark)
    expect(sheet.rules.join('')).toContain(`.${id}{--e-palette-surface:#111111;}`)
  })
})

describe('themes nested as A > B > A', () => {
  it('gives each theme element its own boundary, so a scope stops at the nearest one', () => {
    const { engine, sheet } = setup()
    const a = engine.themeClass(dark, 'dark')
    const b = engine.themeClass(other, 'light')
    const a2 = engine.themeClass(dark, 'dark')
    expect(a2).toBe(a)
    expect(a.split(' ')).toHaveLength(3)
    expect(b.split(' ')).toHaveLength(3)
    // Each of the three elements carries the boundary, and the rule is scoped to A alone.
    expect([a, b, a2].every((classes) => classes.split(' ').includes('e-boundary'))).toBe(true)
    const card = engine.css({ [engine.when(dark, 'dark')]: { border: '1px solid white' } })
    const scoped = sheet.rules.filter((rule) => rule.includes('@scope'))
    expect(scoped).toEqual([
      `@layer e-components{@scope (.${a.split(' ')[0]}) to (.e-boundary){.${card}{border:1px solid white;}}}`,
    ])
  })

  it('applies below A, not below B inside A, and again below the second A (jsdom evaluates @scope, in a layer too)', () => {
    const cache = createCache({ prefix: 'e', hasLayers: true, sheet: createDomSheet('e') })
    const engine = createEngine(base, { prefix: 'e', cache })
    const classes = (theme: typeof base, scheme: 'dark' | 'light') =>
      engine.themeClass(theme, scheme)
    const card = engine.css({
      color: 'rgb(0, 0, 0)',
      [engine.when(dark, 'dark')]: { color: 'rgb(1, 2, 3)' },
    })
    const host = document.createElement('div')
    host.innerHTML = `<div class="${classes(dark, 'dark')}"><i id="x1" class="${card}"></i>
      <div class="${classes(other, 'light')}"><i id="x2" class="${card}"></i>
      <div class="${classes(dark, 'dark')}"><i id="x3" class="${card}"></i></div></div></div>`
    document.body.append(host)
    const color = (id: string) => getComputedStyle(host.querySelector(`#${id}`) as Element).color
    expect([color('x1'), color('x2'), color('x3')]).toEqual([
      'rgb(1, 2, 3)',
      'rgb(0, 0, 0)',
      'rgb(1, 2, 3)',
    ])
    host.remove()
  })
})
