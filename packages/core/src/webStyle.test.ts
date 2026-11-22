// The type tests of the web style: `pnpm typecheck` compiles this file.
import { expectTypeOf } from 'vitest'
import {
  add,
  at,
  alpha,
  createCache,
  createLazyEngine,
  createMemorySheet,
  createSchemeKey,
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
    const { engine, sheet } = setup()
    const classes = [
      // @ts-expect-error `backgroudColor` is not a property
      engine.css({ backgroudColor: 'red' }),
      // @ts-expect-error `gird` is not a display value
      engine.css({ display: 'gird' }),
      // @ts-expect-error a selector needs `&` or a leading `:`
      engine.css({ '> li': { color: 'red' } }),
      // @ts-expect-error a number is not a display value
      engine.css({ display: 4 }),
      // @ts-expect-error a boolean is not a value
      engine.css({ padding: true }),
      // @ts-expect-error a nested style is checked like the top one
      engine.css({ '&:hover': { backgroudColor: 'red' } }),
      // @ts-expect-error `label` is a string
      engine.css({ label: 1 }),
    ]
    // The types are the only guard: at run time the typo and the wrong value are written as given.
    expect(classes).toHaveLength(7)
    expect(sheet.rules.join('')).toContain('backgroud-color:red;')
    expect(sheet.rules.join('')).toContain('display:gird;')
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
    expectTypeOf(sheet.box).toHaveProperty('className')
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

describe('times in a web style', () => {
  it('take a number of milliseconds for a duration or a delay, not for the transition shorthand', () => {
    const style: WebStyleObject = {
      animationDuration: 1500,
      animationDelay: [-200, '0s'],
      transitionDuration: 0,
      transitionDelay: '1s',
    }
    expectTypeOf(style.animationDuration).not.toBeAny()
    const { engine, sheet } = setup()
    // @ts-expect-error a number in the shorthand is not a time
    engine.css({ transition: 300 })
    engine.css(style)
    expect(sheet.rules.join('')).toContain('animation-duration:1500ms;animation-delay:-200ms;')
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

describe('keys that are computed', () => {
  it('are rejected as a computed key in a web style, and accepted through at()', () => {
    const { engine, sheet } = setup()
    const wide: string = 'min-width: 40em'
    const dark = { palette: { primary: '#8888ff' } }
    // @ts-expect-error a computed key has the type string; the `--${string}` signature takes no style
    const direct: WebStyleObject = { [`@media (${wide})`]: { padding: 16 } }
    expect(direct).toBeDefined()
    const style: WebStyleObject = {
      padding: 8,
      ...at(`@media (${wide})`, { padding: 16, '&:hover': { opacity: 0.5 } }),
      ...at(engine.when(dark, 'dark'), { color: 'white' }),
      ...at(createSchemeKey('dark'), { boxShadow: 'none' }),
      ...at(`&.${'open'}`, { margin: 0 }),
      ...at(`:${'hover'}`, false),
    }
    expect(engine.css(style)).toMatch(/^w-/)
    expect(sheet.rules.join('')).toContain('@media (min-width: 40em){')
  })

  it('keep what the type catches: a misspelt property, a wrong value, a custom property value', () => {
    const { engine } = setup()
    const wide: string = 'min-width: 40em'
    // @ts-expect-error a misspelt property inside the style of at()
    at(`@media (${wide})`, { backgroudColor: 'red' })
    // @ts-expect-error a misspelt property next to a spread of at()
    engine.css({ backgroudColor: 'red', ...at(`@media (${wide})`, { padding: 1 }) })
    // @ts-expect-error a wrong value next to a spread of at()
    engine.css({ display: 'gird', ...at(`@media (${wide})`, { padding: 1 }) })
    // @ts-expect-error a label is a string
    engine.css({ label: 1, ...at(`@media (${wide})`, { padding: 1 }) })
    // @ts-expect-error a custom property holds a value, not a style
    engine.css({ '--x': { color: 'red' } })
    // @ts-expect-error a key of at() is a selector or an at-rule
    at('> li', { color: 'red' })
    // @ts-expect-error a key of at() is a literal pattern, not any string
    at(String(wide), { color: 'red' })
    expectTypeOf(at(`@print`, null)).not.toBeAny()
  })
})
