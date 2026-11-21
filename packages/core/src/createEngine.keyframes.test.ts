import { alpha } from './alpha'
import { createCache, createMemorySheet } from './cache'
import { add, divide, multiply, negate, subtract } from './calc'
import { createEngine, createLazyEngine, NO_THEME_MESSAGE } from './createEngine'
import { keyframes, type KeyframesSteps } from './keyframes'

const theme = {
  palette: { primary: '#0000ff', muted: '#888888' },
  opacity: { faint: 0.2 },
  breakpoints: { md: 768 },
  space: [0, 4, 8],
}

type AppTheme = typeof theme

const fadeTo = (view: AppTheme) => ({
  from: { opacity: view.opacity.faint, color: view.palette.muted },
  to: { opacity: 1, color: view.palette.primary },
})

function setup(prefix = 'e', options: Parameters<typeof createEngine>[1] = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix, sheet, hasLayers: false })
  const engine = createEngine<AppTheme>(theme, { prefix, cache, ...options })
  return { engine, sheet }
}

const keyframesRules = (rules: readonly string[]) =>
  rules.filter((rule) => rule.startsWith('@keyframes'))

describe('keyframes in an engine', () => {
  it('returns the name that keyframes returns, the same for every engine, prefix and theme', () => {
    const name = setup('e').engine.keyframes(fadeTo)
    expect(setup('other').engine.keyframes(fadeTo)).toBe(name)
    const dark = createEngine<AppTheme>(
      { ...theme, palette: { primary: '#ff0000', muted: '#111111' } },
      { prefix: 'd', modes: { palette: 'inline' } }
    )
    expect(dark.keyframes(fadeTo)).toBe(name)
    expect(keyframes(fadeTo)).toBe(name)
    expect(name).toMatch(/^keyframes-/)
  })

  it('writes nothing at the call, and the rule with references to the tokens when a class uses it', () => {
    const { engine, sheet } = setup()
    const name = engine.keyframes(fadeTo, { label: 'fade-to' })
    expect(sheet.rules).toEqual([])
    engine
      .createStyler({ name: 'Skeleton' }, [
        { animationName: name, animationDuration: '1.5s', animationIterationCount: 'infinite' },
      ])
      .getClassName({})
    expect(keyframesRules(sheet.rules)).toEqual([
      `@keyframes ${name}{0%{opacity:var(--e-opacity-faint);color:var(--e-palette-muted);}100%{opacity:1;color:var(--e-palette-primary);}}`,
    ])
  })

  it('reads the keys that hold real values from the base theme: raw keys and the inline mode', () => {
    const { engine, sheet } = setup('e', { modes: { opacity: 'inline' } })
    const name = engine.keyframes((view: AppTheme) => ({
      to: { opacity: view.opacity.faint, width: view.breakpoints.md },
    }))
    engine.css({ animation: `${name} 1s` })
    expect(keyframesRules(sheet.rules)).toEqual([
      `@keyframes ${name}{100%{opacity:0.2;width:768px;}}`,
    ])
  })

  it('names steps that compute with tokens through every helper, and writes them with the references', () => {
    const cases: [(view: AppTheme) => KeyframesSteps, string][] = [
      [
        (view) => ({ to: { margin: add(view.space[1], view.space[2]) } }),
        'margin:calc(var(--e-space-1) + var(--e-space-2));',
      ],
      [
        (view) => ({ to: { margin: subtract(view.space[2], 4) } }),
        'margin:calc(var(--e-space-2) - 4px);',
      ],
      [
        (view) => ({ to: { margin: multiply(view.space[2], 2) } }),
        'margin:calc(var(--e-space-2) * 2);',
      ],
      [
        (view) => ({ to: { margin: divide(view.space[2], 2) } }),
        'margin:calc(var(--e-space-2) / 2);',
      ],
      [
        (view) => ({ to: { margin: negate(view.space[1]) } }),
        'margin:calc(var(--e-space-1) * -1);',
      ],
      [
        (view) => ({ to: { color: alpha(view.palette.primary, 0.5) } }),
        'color:var(--e-palette-primary);color:color-mix(in srgb, var(--e-palette-primary) 50%, transparent);',
      ],
    ]
    for (const [steps, declarations] of cases) {
      const { engine, sheet } = setup()
      const name = engine.keyframes(steps)
      expect(name).toMatch(/^keyframes-[0-9a-z]+$/)
      engine.css({ animationName: name })
      expect(keyframesRules(sheet.rules)).toEqual([`@keyframes ${name}{100%{${declarations}}}`])
    }
  })

  it('names an animation before there is a theme, and resolves it against the theme given later', () => {
    const sheet = createMemorySheet()
    const engine = createLazyEngine<AppTheme>({
      cache: createCache({ prefix: 'l', sheet, hasLayers: false }),
    })
    const name = engine.keyframes((view: AppTheme) => ({ to: { color: view.palette.primary } }))
    expect(() => engine.css({ animationName: name })).toThrow(NO_THEME_MESSAGE)
    engine.setTheme(theme)
    engine.css({ animationName: name, color: 'red' })
    expect(keyframesRules(sheet.rules)).toEqual([
      `@keyframes ${name}{100%{color:var(--l-palette-primary);}}`,
    ])
  })

  it('writes the rule of a function style and of a sheet entry that use the name', () => {
    const { engine, sheet } = setup()
    const spin = engine.keyframes({ to: { transform: 'rotate(1turn)' } }, { label: 'spin' })
    const pulse = engine.keyframes({ '50%': { opacity: 0.5 } }, { label: 'pulse' })
    engine
      .createStyler({}, [({ isBusy }: { isBusy: boolean }) => isBusy && { animationName: spin }])
      .getClassName({ isBusy: true })
    const sheetEntries = engine.createSheet({ root: { animation: `${pulse} 1s` } })
    engine.css(sheetEntries.root)
    expect(keyframesRules(sheet.rules)).toEqual([
      `@keyframes ${spin}{100%{transform:rotate(1turn);}}`,
      `@keyframes ${pulse}{50%{opacity:0.5;}}`,
    ])
  })

  it('writes a rule now with insertKeyframes, and throws for a name it did not make', () => {
    const { engine, sheet } = setup()
    const name = engine.keyframes(fadeTo)
    engine.insertKeyframes(name)
    expect(keyframesRules(sheet.rules)).toHaveLength(1)
    expect(() => engine.insertKeyframes('app-own')).toThrow(TypeError)
  })
})
