// The type tests of the default style types: `pnpm typecheck` compiles this file without the strict
// switch (tsconfig.json); styleTypes.strict.test.ts and tsconfig.strict.json are the strict ones.
import { expectTypeOf } from 'vitest'
import {
  createCache,
  createLazyEngine,
  createMemorySheet,
  keyframes,
  type StyleObject,
  type WebProperties,
  type WebStyleObject,
} from './index'

interface AppTheme {
  space: number[]
  breakpoints: string[]
  palette: { primary: { main: string } }
}

function setup() {
  const sheet = createMemorySheet()
  const engine = createLazyEngine<AppTheme>({
    cache: createCache({ hasLayers: false, prefix: 'd', sheet }),
  })
  return { engine, sheet }
}

describe('the default style types', () => {
  it('accept a style whose values were widened to string, as an argument and from a function', () => {
    const { engine, sheet } = setup()
    const isFullWidth = Math.random() > 2
    // Built with no contextual type: `display` and `alignItems` are `string` here.
    const frame = (theme: AppTheme) => ({
      display: isFullWidth ? 'flex' : 'inline-flex',
      alignItems: 'center',
      gap: theme.space[1],
      flexWrap: 'wrap' as const,
      '&:focus-within': { borderColor: theme.palette.primary.main },
      ...(isFullWidth && { width: '100%' }),
    })
    const theme: AppTheme = {
      space: [0, 4],
      breakpoints: ['40em'],
      palette: { primary: { main: 'red' } },
    }
    expect(engine.css(frame(theme))).toMatch(/^d-/)
    const styler = engine.createStyler({}, [({ theme: view }) => frame(view)])
    expect(styler).toBeDefined()
    expect(sheet.rules.join('')).toContain('display:inline-flex;align-items:center;gap:4px;')
  })

  it('accept a key computed at run time, with a nested style or a value', () => {
    const { engine, sheet } = setup()
    const theme: AppTheme = {
      space: [0, 4],
      breakpoints: ['40em'],
      palette: { primary: { main: 'red' } },
    }
    const vertical: 'top' | 'bottom' = 'bottom'
    const edge = Math.random() > 2 ? 'borderTopColor' : 'borderLeftColor'
    const style = {
      [vertical]: theme.space[1],
      [`@media (min-width: ${theme.breakpoints[0]})`]: { gap: 16 },
      '& > [aria-pressed="true"]:not(:first-of-type)': { [edge]: theme.palette.primary.main },
    }
    const typed: WebStyleObject = style
    expect(engine.css(typed)).toMatch(/^d-/)
    expect(sheet.rules.join('')).toContain('@media (min-width: 40em){')
  })

  it('still complete the known values and reject what is never a value', () => {
    const { engine } = setup()
    expectTypeOf<'grid'>().toExtend<NonNullable<WebStyleObject['display']>>()
    expectTypeOf<string>().toExtend<NonNullable<WebStyleObject['display']>>()
    expectTypeOf<NonNullable<WebProperties['display']>>().not.toEqualTypeOf<string>()
    expectTypeOf<WebStyleObject['color']>().not.toBeAny()
    expectTypeOf<WebStyleObject['&:hover']>().not.toBeAny()
    expectTypeOf<StyleObject>().toExtend<WebStyleObject>()
    // @ts-expect-error a boolean is not a value
    engine.css({ padding: true })
    // @ts-expect-error `label` is a string
    engine.css({ label: 1 })
    // @ts-expect-error a misspelt property in a step of keyframes: a step's keys are still checked
    expect(keyframes({ from: { opacty: 0 } })).toMatch(/^keyframes-/)
  })
})
