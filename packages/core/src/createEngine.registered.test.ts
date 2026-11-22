import { alpha } from './alpha'
import { createCache, createMemorySheet } from './cache'
import { createEngine, createLazyEngine } from './createEngine'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const theme = {
  palette: { primary: '#0000ff', surface: '#ffffff', mode: 'light' },
  space: [0, 4, 8],
  opacity: { disabled: 0.4 },
}

type AppTheme = typeof theme

const primaryRule =
  '@property --e-palette-primary{syntax:"<color>";inherits:true;initial-value:#0000ff;}'
const spaceRule = '@property --e-space-1{syntax:"<length>";inherits:true;initial-value:4px;}'

function setup(options: Parameters<typeof createEngine>[1] = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({
    prefix: 'e',
    hasLayers: options.hasLayers,
    sheet,
    hasPruning: options.hasPruning,
  })
  const engine = createEngine<AppTheme>(theme, {
    prefix: 'e',
    cache,
    registered: { 'palette.primary': true, 'palette.surface': '<color>', 'space.1': true },
    ...options,
  })
  return { engine, sheet, cache }
}

const rulesOf = (sheet: { rules: readonly string[] }) =>
  sheet.rules.filter((rule) => rule.startsWith('@property'))

describe('a registered token in an engine', () => {
  it('gets its @property rule when a rule first uses it, not before, and one rule for each token', () => {
    const { engine, sheet } = setup()
    expect(rulesOf(sheet)).toEqual([])
    engine
      .createStyler({}, [
        ({ theme: view }: { theme: AppTheme }) => ({ color: view.palette.primary }),
      ])
      .getClassName({})
    expect(rulesOf(sheet)).toEqual([primaryRule])
    engine.css({ padding: engine.refs.space[1], margin: engine.refs.space[1] })
    expect(rulesOf(sheet)).toEqual([primaryRule, spaceRule])
  })

  it('does not register a token that is not used, or a token that is not registered', () => {
    const { engine, sheet } = setup()
    engine.css({ color: engine.refs.palette.mode, margin: engine.refs.space[2] })
    expect(rulesOf(sheet)).toEqual([])
  })

  it('writes the rules before the layered rules that use them, outside every layer', () => {
    const { engine, sheet } = setup({ hasLayers: true })
    engine.css({ color: engine.refs.palette.primary })
    expect(sheet.rules[0]).toBe('@layer e-theme,e-global,e-components,e-overrides;')
    expect(rulesOf(sheet)).toEqual([primaryRule])
    expect(
      sheet.rules.filter((rule) => rule.includes('@property') && rule.startsWith('@layer'))
    ).toEqual([])
  })

  it('registers every used token at once without pruning', () => {
    const { sheet } = setup({ hasPruning: false })
    expect(rulesOf(sheet)).toEqual([
      primaryRule,
      '@property --e-palette-surface{syntax:"<color>";inherits:true;initial-value:#ffffff;}',
      spaceRule,
    ])
  })

  it('registers a variable that alwaysDeclare names', () => {
    const { sheet } = setup({ alwaysDeclare: ['palette'] })
    expect(rulesOf(sheet)).toEqual([
      primaryRule,
      '@property --e-palette-surface{syntax:"<color>";inherits:true;initial-value:#ffffff;}',
    ])
  })

  it('registers a token that is used through alpha(), in either declaration', () => {
    const { engine, sheet } = setup()
    engine.css({ background: alpha(engine.refs.palette.primary, 0.1) })
    expect(rulesOf(sheet)).toEqual([primaryRule])
  })

  it('throws a TypeError at creation for a token that cannot be registered', () => {
    expect(() => createEngine(theme, { registered: { palette: true } })).toThrow(
      /"palette\.mode".*cannot be inferred/
    )
    expect(() => createEngine(theme, { registered: { 'palette.primary': '<length>' } })).toThrow(
      TypeError
    )
  })

  it('has the rules that the new base theme gives, after a setTheme', () => {
    const { engine, sheet } = setup()
    engine.css({ color: engine.refs.palette.primary })
    engine.setTheme({ ...theme, palette: { ...theme.palette, primary: '#ff0000' } })
    expect(rulesOf(sheet)).toEqual([
      primaryRule,
      '@property --e-palette-primary{syntax:"<color>";inherits:true;initial-value:#ff0000;}',
    ])
  })

  it('takes the registrations of the theme that a lazy engine gets first', () => {
    const sheet = createMemorySheet()
    const engine = createLazyEngine<AppTheme>({
      prefix: 'e',
      cache: createCache({ prefix: 'e', sheet }),
      registered: { 'palette.primary': true },
    })
    engine.themeId({ palette: { primary: '#123456' } } as AppTheme)
    engine.css({ color: engine.refs.palette.primary })
    expect(rulesOf(sheet)).toEqual([
      '@property --e-palette-primary{syntax:"<color>";inherits:true;initial-value:#123456;}',
    ])
  })
})

describe('a registered token in a theme', () => {
  it('still resolves in a nested theme, which sets the variable on its wrapper', () => {
    const engine = createEngine(theme, {
      prefix: 'e',
      registered: { 'palette.primary': '<color>' },
    })
    const outer = engine.themeId(theme)
    const inner = engine.themeId({ palette: { primary: '#ff0000' } })
    const style = engine.css({ color: engine.refs.palette.primary })

    document.body.innerHTML = `<div class="${outer}"><div class="${inner}"><p class="${style}"></p></div><p class="${style}" id="plain"></p></div>`
    const read = (element: Element | null) =>
      getComputedStyle(element as Element).getPropertyValue('--e-palette-primary')
    // jsdom computes a registered <color> variable: the value comes back as rgb().
    expect(read(document.querySelector('p'))).toBe('rgb(255, 0, 0)')
    expect(read(document.getElementById('plain'))).toBe('rgb(0, 0, 255)')
    const texts = Array.from(document.styleSheets).flatMap((sheet) =>
      Array.from(sheet.cssRules).map((rule) => rule.cssText)
    )
    expect(texts.filter((text) => text.startsWith('@property --e-palette-primary'))).toHaveLength(1)
  })
})
