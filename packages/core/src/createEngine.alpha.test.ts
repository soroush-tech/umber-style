import { alpha } from './alpha'
import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'

const theme = {
  palette: { primary: '#0000ff', accent: '#ff0000', surface: '#ffffff' },
}

type AppTheme = typeof theme

function setup(options: Parameters<typeof createEngine>[1] = {}) {
  const engine = createEngine<AppTheme>(theme, { prefix: 'e', hasLayers: false, ...options })
  return { engine }
}

describe('alpha in an engine', () => {
  it('writes the fallback and then the mix for a token, and for each literal form', () => {
    const { engine } = setup()
    const { cache } = engine
    const texts = [
      alpha(engine.refs.palette.primary, 0.1),
      alpha('#1b5fd1', 0.5),
      alpha('#1b5fd180', 0.5),
      alpha('rgb(1, 2, 3)', 0.5),
      alpha('rgb(1 2 3 / 40%)', 0.5),
      alpha('red', 0.5),
    ].map((value) => {
      const className = cache.css({ background: value })
      return cache.getRules(className)[0]
    })
    expect(texts).toEqual([
      expect.stringMatching(
        /^\.e-[a-z0-9]+\{background:var\(--e-palette-primary\);background:color-mix\(in srgb, var\(--e-palette-primary\) 10%, transparent\);\}$/
      ),
      expect.stringContaining(
        '{background:rgba(27, 95, 209, 0.5);background:color-mix(in srgb, #1b5fd1 50%, transparent);}'
      ),
      expect.stringContaining('{background:rgba(27, 95, 209, 0.251);background:color-mix('),
      expect.stringContaining('{background:rgba(1, 2, 3, 0.5);background:color-mix('),
      expect.stringContaining('{background:rgba(1, 2, 3, 0.2);background:color-mix('),
      expect.stringContaining(
        '{background:red;background:color-mix(in srgb, red 50%, transparent);}'
      ),
    ])
  })

  it('writes the mix alone with hasColorFallbacks: false, as before', () => {
    const { engine } = setup({ hasColorFallbacks: false })
    const className = engine.css({ background: alpha(engine.refs.palette.primary, 0.1) })
    expect(engine.cache.getRules(className)).toEqual([
      `.${className}{background:color-mix(in srgb, var(--e-palette-primary) 10%, transparent);}`,
    ])
  })

  it('has hasColorFallbacks on by default, for a cache the engine makes', () => {
    const { engine } = setup()
    const className = engine.css({ color: alpha('#fff', 0.5) })
    expect(engine.cache.getRules(className)[0]).toContain(
      `color:rgba(255, 255, 255, 0.5);color:color-mix(`
    )
  })

  it('leaves the option to the cache that is given', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'e', hasLayers: false, hasColorFallbacks: false, sheet })
    const engine = createEngine<AppTheme>(theme, { prefix: 'e', cache })
    engine.css({ color: alpha('#fff', 0.5) })
    expect(sheet.rules.join('')).not.toContain('rgba(')
  })

  it('declares a token that is used only inside alpha(), in both declarations', () => {
    const { engine } = setup()
    const { cache } = engine
    const scope = engine.themeClass(theme)
    expect(cache.getRules(scope)).toEqual([])
    engine.css({ background: alpha(engine.refs.palette.accent, 0.2) })
    expect(cache.usedVariables.has('--e-palette-accent')).toBe(true)
    expect(cache.usedVariables.has('--e-palette-primary')).toBe(false)
    expect(cache.getRules(scope)).toEqual([`.${scope}{--e-palette-accent:#ff0000;}`])
  })

  it('declares it with the mix alone, too', () => {
    const { engine } = setup({ hasColorFallbacks: false })
    const scope = engine.themeClass(theme)
    engine.css({ background: alpha(engine.refs.palette.accent, 0.2) })
    expect(engine.cache.getRules(scope)).toEqual([`.${scope}{--e-palette-accent:#ff0000;}`])
  })
})
