import { createCache, createMemorySheet } from './cache'
import { createEngine, createLazyEngine, NO_THEME_MESSAGE } from './createEngine'
import { globalStyles } from './globalStyles'
import { keyframes } from './keyframes'

const theme = {
  palette: { background: '#ffffff', text: '#111111' },
  breakpoints: { md: 768 },
}

type AppTheme = typeof theme

// Made at module scope, before any engine exists.
const base = globalStyles((view: AppTheme) => ({
  '*, *::before, *::after': { boxSizing: 'border-box' },
  body: { margin: 0, background: view.palette.background, color: view.palette.text },
  [`@media (min-width: ${view.breakpoints.md}px)`]: { body: { fontSize: 18 } },
  '@font-face': [
    { fontFamily: 'Inter', fontWeight: 400, src: 'url(/inter-400.woff2)' },
    { fontFamily: 'Inter', fontWeight: 700, src: 'url(/inter-700.woff2)' },
  ],
}))
const reset = globalStyles({ html: { WebkitTextSizeAdjust: '100%' } })

function setup(options: Parameters<typeof createEngine>[1] = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 'e', sheet, hasLayers: false })
  const engine = createEngine<AppTheme>(theme, { prefix: 'e', cache, ...options })
  return { engine, sheet }
}

describe('global styles in an engine', () => {
  it('writes a function of the theme with references to the tokens and the raw keys of the base theme', () => {
    const { engine, sheet } = setup()
    engine.insertGlobal(base)
    expect(sheet.rules).toEqual([
      '*, *::before, *::after{box-sizing:border-box;}',
      'body{margin:0;background:var(--e-palette-background);color:var(--e-palette-text);}',
      '@media (min-width: 768px){body{font-size:18px;}}',
      '@font-face{font-family:Inter;font-weight:400;src:url(/inter-400.woff2);}',
      '@font-face{font-family:Inter;font-weight:700;src:url(/inter-700.woff2);}',
    ])
  })

  it('reads the keys that hold real values from the theme it is given, as another set of rules', () => {
    const { engine, sheet } = setup()
    const media = globalStyles((view: AppTheme) => ({
      [`@media (min-width: ${view.breakpoints.md}px)`]: { body: { color: view.palette.text } },
    }))
    engine.insertGlobal(media)
    const view = engine.createThemeView({ ...theme, breakpoints: { md: 1024 } })
    const release = engine.insertGlobal(media, view)
    engine.insertGlobal(media, engine.createThemeView(theme))
    expect(sheet.rules).toEqual([
      '@media (min-width: 768px){body{color:var(--e-palette-text);}}',
      '@media (min-width: 1024px){body{color:var(--e-palette-text);}}',
    ])
    release()
    expect(sheet.rules).toHaveLength(1)
  })

  it('reads a token in the inline mode from the base theme', () => {
    const { engine, sheet } = setup({ modes: { palette: 'inline' } })
    engine.insertGlobal((view: AppTheme) => ({ body: { color: view.palette.text } }))
    expect(sheet.rules).toEqual(['body{color:#111111;}'])
  })

  it('writes a list in its order, handles, objects and functions alike, and releases it all at once', () => {
    const { engine, sheet } = setup()
    const release = engine.insertGlobal([
      reset,
      { body: { margin: 0 } },
      (view: AppTheme) => ({ body: { color: view.palette.text } }),
    ])
    expect(sheet.rules).toEqual([
      'html{-webkit-text-size-adjust:100%;}',
      'body{margin:0;}',
      'body{color:var(--e-palette-text);}',
    ])
    release()
    expect(sheet.rules).toEqual([])
  })

  it('writes equal content once, whatever form it is given in, and keeps it until the last release', () => {
    const { engine, sheet } = setup()
    const first = engine.insertGlobal(reset)
    const second = engine.insertGlobal({ html: { WebkitTextSizeAdjust: '100%' } })
    expect(sheet.rules).toEqual(['html{-webkit-text-size-adjust:100%;}'])
    first()
    expect(sheet.rules).toHaveLength(1)
    second()
    expect(sheet.rules).toEqual([])
  })

  it('resolves global styles for a theme into ids, rules and animations, writing nothing', () => {
    const { engine, sheet } = setup()
    const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const sets = engine.resolveGlobal([reset, { body: { animation: `${fade} 1s` } }])
    expect(sets).toEqual([
      {
        id: expect.stringMatching(/^e-global-/),
        rules: ['html{-webkit-text-size-adjust:100%;}'],
        animations: [],
      },
      {
        id: expect.stringMatching(/^e-global-/),
        rules: [`body{animation:${fade} 1s;}`],
        animations: [fade],
      },
    ])
    expect(engine.resolveGlobal(reset)).toEqual([sets[0]])
    expect(sheet.rules).toEqual([])
  })

  it('writes an object before there is a theme, and a function once there is one', () => {
    const sheet = createMemorySheet()
    const engine = createLazyEngine<AppTheme>({
      cache: createCache({ prefix: 'l', sheet, hasLayers: false }),
    })
    engine.insertGlobal(reset)
    expect(() => engine.insertGlobal(base)).toThrow(NO_THEME_MESSAGE)
    engine.setTheme(theme)
    engine.insertGlobal((view: AppTheme) => ({ body: { color: view.palette.text } }))
    expect(sheet.rules).toEqual([
      'html{-webkit-text-size-adjust:100%;}',
      'body{color:var(--l-palette-text);}',
    ])
  })

  it('writes the rules into the global layer with layers', () => {
    const sheet = createMemorySheet()
    const engine = createEngine<AppTheme>(theme, { cache: createCache({ prefix: 'g', sheet }) })
    engine.insertGlobal(reset)
    expect(sheet.rules).toEqual([
      engine.cache.layerOrder,
      '@layer g-global{html{-webkit-text-size-adjust:100%;}}',
    ])
  })
})
