// The type tests of the web style: `pnpm typecheck` compiles this file.
import { expectTypeOf } from 'vitest'
import {
  add,
  createCache,
  createLazyEngine,
  createMemorySheet,
  divide,
  multiply,
  negate,
  subtract,
  type StyleFunction,
  type StyleObject,
  type WebStyleObject,
} from './index'

function setup() {
  const sheet = createMemorySheet()
  const engine = createLazyEngine<{ palette: { primary: string } }>({
    cache: createCache({ prefix: 'w', sheet }),
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
