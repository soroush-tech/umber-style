import { createCache, createMemorySheet } from './cache'
import { createEngine, createLazyEngine } from './createEngine'

const theme = { palette: { primary: '#0000ff', text: '#111111' }, breakpoints: ['600px'] }
const dark = { palette: { primary: '#8888ff', text: '#eeeeee' }, breakpoints: ['600px'] }

function setup() {
  const sheet = createMemorySheet()
  const cache = createCache({ hasLayers: false, prefix: 'r', sheet })
  const roots = () => sheet.rules.filter((rule) => rule.includes(':where(:root)'))
  return { sheet, cache, roots }
}

describe('declareRoot', () => {
  it('declares the tokens of a theme on :root and returns the id of the rule', () => {
    const { cache, roots } = setup()
    const engine = createEngine(theme, { cache })
    const id = engine.declareRoot(theme, 'light')
    expect(id).toMatch(/^r-root-/)
    engine.css({ color: engine.refs.palette.primary })
    expect(roots()).toEqual([':where(:root){--r-palette-primary:#0000ff;color-scheme:light;}'])
    expect(engine.declareRoot(theme, 'light')).toBe(id)
  })

  it('replaces the root theme with another one, and back', () => {
    const { cache, roots } = setup()
    const engine = createEngine(theme, { cache })
    engine.css({ color: engine.refs.palette.text })
    const light = engine.declareRoot(theme)
    engine.declareRoot(dark)
    expect(roots()).toEqual([':where(:root){--r-palette-text:#eeeeee;}'])
    expect(engine.declareRoot(theme)).toBe(light)
    expect(roots()).toEqual([':where(:root){--r-palette-text:#111111;}'])
  })

  it('gives the engine its base theme when it has none', () => {
    const { cache } = setup()
    const engine = createLazyEngine<typeof theme>({ cache })
    engine.declareRoot(theme)
    expect(engine.baseTheme).toBe(theme)
  })
})
