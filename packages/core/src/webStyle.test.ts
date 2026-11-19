// The type tests of the web style: `pnpm typecheck` compiles this file.
import { expectTypeOf } from 'vitest'
import {
  add,
  alpha,
  createCache,
  createLazyEngine,
  createMemorySheet,
  divide,
  multiply,
  negate,
  subtract,
  type AlphaColor,
  type Operand,
  type StyleFunction,
  type StyleObject,
  type WebStyleObject,
} from './index'

function setup() {
  const sheet = createMemorySheet()
  const engine = createLazyEngine<{ palette: { primary: string } }>({
    cache: createCache({ hasLayers: false, prefix: 'w', sheet }),
  })
  return { engine, sheet }
}

describe('WebStyleObject', () => {
  it('accepts every kind of key', () => {
    const style: WebStyleObject = {
      label: 'box',
      color: 'red',
      padding: 8,
      display: 'block flex',
      margin: ['1px', 2],
      zIndex: 3,
      fontWeight: 600,
      '--accent': '#ff0000',
      '--size': 4,
      '&:hover': { opacity: 0.8, '&:focus': { outline: 'none' } },
      ':first-child': { margin: 0 },
      '@media (min-width: 40em)': { padding: 16 },
      '&.open': false,
      '@print': null,
    }
    const { engine, sheet } = setup()
    expect(engine.css(style)).toMatch(/^w-box-/)
    expect(sheet.rules.join('')).toContain('--accent:#ff0000;')
  })

  it('has no any in it', () => {
    expectTypeOf<WebStyleObject['color']>().not.toBeAny()
    expectTypeOf<WebStyleObject['&:hover']>().not.toBeAny()
    expectTypeOf<WebStyleObject['--x']>().not.toBeAny()
  })

  it('is accepted by the loose type, and not the other way round', () => {
    expectTypeOf<WebStyleObject>().toExtend<StyleObject>()
    expectTypeOf<StyleObject>().not.toExtend<WebStyleObject>()
  })

  it('rejects a misspelt property, a wrong value and a key that is not a selector', () => {
    const { engine } = setup()
    // @ts-expect-error `backgroudColor` is not a property
    engine.css({ backgroudColor: 'red' })
    // @ts-expect-error `gird` is not a display value
    engine.css({ display: 'gird' })
    // @ts-expect-error a selector needs `&` or a leading `:`
    engine.css({ '> li': { color: 'red' } })
    // @ts-expect-error a number is not a display value
    engine.css({ display: 4 })
    // @ts-expect-error a boolean is not a value
    engine.css({ padding: true })
    // @ts-expect-error a nested style is checked like the top one
    engine.css({ '&:hover': { backgroudColor: 'red' } })
    // @ts-expect-error `label` is a string
    engine.css({ label: 1 })
  })

  it('does not catch what a variable holds, and does not check an untyped function return', () => {
    const { engine } = setup()
    const widened = { color: 'red', backgroudColor: 'red' }
    engine.css(widened)
    const only = { backgroudColor: 'red' }
    engine.css(only)
    const fn: StyleFunction<{ palette: { primary: string } }, object> = () => ({
      backgroudColor: 'red',
    })
    expectTypeOf(fn).toBeFunction()
  })

  it('takes the loose type through a cast', () => {
    const { engine } = setup()
    const loose: StyleObject = { anything: 'goes' }
    // @ts-expect-error the loose type is not accepted as it is
    engine.css(loose)
    expect(engine.css(loose as WebStyleObject)).toMatch(/^w-/)
  })

  it('is what createSheet and createStyler take', () => {
    const { engine } = setup()
    const sheet = engine.createSheet({ box: { padding: 8, '&:hover': { opacity: 1 } } })
    expectTypeOf(sheet.resolve().box).toHaveProperty('className')
    engine.createSheet((theme) => ({ box: { color: theme.palette.primary } }))
    // @ts-expect-error a misspelt property in a sheet
    engine.createSheet({ box: { backgroudColor: 'red' } })
    // @ts-expect-error a wrong value in a sheet
    engine.createSheet({ box: { display: 'gird' } })
    engine.createStyler({}, [{ padding: 8 }, () => ({ color: 'red' })])
    // @ts-expect-error a misspelt property in a style list
    engine.createStyler({}, [{ backgroudColor: 'red' }])
  })
})

describe('the arithmetic helpers in a web style', () => {
  it('are accepted as values, a negative margin included', () => {
    const space = 'var(--u-space-2)'
    const style: WebStyleObject = {
      marginLeft: negate(space),
      margin: [negate(space), 0],
      padding: multiply(space, 2),
      width: add(space, 4),
      height: subtract(8, 2),
      gap: divide(space, 2),
      '&:hover': { top: negate(4) },
    }
    expectTypeOf(style.marginLeft).not.toBeAny()
    expect(style.padding).toBe('calc(var(--u-space-2) * 2)')
  })
})

describe('alpha in a web style', () => {
  it('is accepted by a color property, in a list, in a nested style and in a custom property', () => {
    const base = 'var(--u-palette-primary)'
    const style: WebStyleObject = {
      background: alpha(base, 0.1),
      color: [alpha(base, 0.5), 'red'],
      borderTopColor: alpha('#fff', 0.2),
      '--tint': alpha(base, 0.3),
      '&:hover': { backgroundColor: alpha(base, 0.2) },
      border: `1px solid ${alpha(base, 0.5)}`,
    }
    const { engine, sheet } = setup()
    expect(engine.css(style)).toMatch(/^w-/)
    expect(sheet.rules.join('')).toContain('--tint:color-mix(in srgb, var(--u-palette-primary) 30%')
  })

  it('is typed as a color: accepted where a color goes, not as a length or an operand', () => {
    expectTypeOf(alpha).returns.toEqualTypeOf<AlphaColor | string>()
    expectTypeOf<AlphaColor>().toExtend<NonNullable<WebStyleObject['background']>>()
    expectTypeOf<AlphaColor>().toExtend<NonNullable<WebStyleObject['--any']>>()
    expectTypeOf<AlphaColor>().not.toExtend<NonNullable<WebStyleObject['padding']>>()
    expectTypeOf<AlphaColor>().not.toExtend<NonNullable<WebStyleObject['display']>>()
    expectTypeOf<AlphaColor>().not.toExtend<Operand>()
    expectTypeOf<AlphaColor>().not.toBeAny()
  })

  it('compiles in a style function against the theme', () => {
    const { engine } = setup()
    const fn: StyleFunction<{ palette: { primary: string } }, object> = ({ theme }) => ({
      background: alpha(theme.palette.primary, 0.1),
    })
    expect(typeof fn).toBe('function')
    expect(engine.createStyler({}, [fn])).toBeDefined()
  })
})
