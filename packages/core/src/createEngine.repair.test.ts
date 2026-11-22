import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { globalStyles } from './globalStyles'

const theme = {
  palette: { primary: '#0000ff' },
  transitions: { duration: { short: 150 } },
  space: [0, 4, 8],
}

type AppTheme = typeof theme

const MIX = 'color-mix(in srgb, var(--e-palette-primary) 12.16%, transparent)'

function setup(options: Parameters<typeof createEngine>[1] = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 'e', sheet, hasLayers: false, ...options })
  const engine = createEngine<AppTheme>(theme, { prefix: 'e', cache })
  return { engine, sheet }
}

/** A style that builds strings from tokens as code written for real values does. */
const tokenMaths = ({ palette, space, transitions }: AppTheme) => ({
  background: `${palette.primary}1F`,
  marginLeft: `-${space[2]}`,
  transitionDuration: `${transitions.duration.short}ms`,
})

describe('hasValueRepair in an engine', () => {
  it('rewrites the string forms of token maths with hasValueRepair: true', () => {
    const engine = createEngine<AppTheme>(theme, {
      prefix: 'e',
      hasLayers: false,
      hasValueRepair: true,
    })
    const className = engine.css(tokenMaths(engine.refs))
    expect(engine.cache.getRules(className)).toEqual([
      `.${className}{background:${MIX};margin-left:calc(var(--e-space-2) * -1);transition-duration:calc(var(--e-transitions-duration-short) * 1ms);}`,
    ])
  })

  it('writes the example of the Tokens page', () => {
    const page = {
      palette: { primary: '#1b5fd1', text: '#1a1a1a' },
      space: [0, 4, 8, 16],
      transitions: { duration: { short: 150 } },
    }
    const engine = createEngine(page, { prefix: 'umber', hasValueRepair: true })
    const { palette, space, transitions } = engine.refs
    const className = engine.css({
      background: `${palette.primary}1F`,
      border: `1px solid ${palette.primary}80`,
      marginLeft: `-${space[2]}`,
      transition: `opacity ${transitions.duration.short}ms`,
    })
    expect(className).toBe('umber-jsrgfl')
    expect(engine.cache.getRules(className)).toEqual([
      '@layer umber-components{.umber-jsrgfl{background:color-mix(in srgb, var(--umber-palette-primary) 12.16%, transparent);border:1px solid color-mix(in srgb, var(--umber-palette-primary) 50.2%, transparent);margin-left:calc(var(--umber-space-2) * -1);transition:opacity calc(var(--umber-transitions-duration-short) * 1ms);}}',
    ])
  })

  it('has it off by default, and writes the text as it is', () => {
    const engine = createEngine<AppTheme>(theme, { prefix: 'e', hasLayers: false })
    const className = engine.css(tokenMaths(engine.refs))
    expect(engine.cache.getRules(className)).toEqual([
      `.${className}{background:var(--e-palette-primary)1F;margin-left:-var(--e-space-2);transition-duration:var(--e-transitions-duration-short)ms;}`,
    ])
  })

  it('keeps the option over a cache that is given, as it describes how the styles are written', () => {
    const { engine, sheet } = setup({ hasValueRepair: true })
    const other = createEngine<AppTheme>(theme, {
      prefix: 'e',
      cache: createCache({ prefix: 'e', sheet: createMemorySheet() }),
      hasValueRepair: true,
    })
    engine.css({ color: `${engine.refs.palette.primary}1F` })
    expect(sheet.rules.join('')).toContain(MIX)
    const className = other.css({ color: `${other.refs.palette.primary}1F` })
    expect(other.cache.getRules(className)[0]).toContain(
      'color:color-mix(in srgb, var(--e-palette-primary) 12.16%, transparent);'
    )
  })

  it('declares a token that is used only inside a rewritten form', () => {
    const { engine } = setup({ hasValueRepair: true })
    const scope = engine.themeId(theme)
    engine.css({ background: `${engine.refs.palette.primary}1F` })
    expect(engine.cache.getRules(scope)).toEqual([`.${scope}{--e-palette-primary:#0000ff;}`])
  })

  it('reaches global rules', () => {
    const { engine, sheet } = setup({ hasValueRepair: true })
    const base = globalStyles((view: AppTheme) => ({
      body: { color: `${view.palette.primary}1F` },
      '@media print': { body: { margin: `0 -${view.space[2]}` } },
    }))
    engine.insertGlobal(base)
    expect(sheet.rules).toContain(`body{color:${MIX};}`)
    expect(sheet.rules).toContain('@media print{body{margin:0 calc(var(--e-space-2) * -1);}}')
  })

  it('reaches the steps of keyframes', () => {
    const { engine, sheet } = setup({ hasValueRepair: true })
    const name = engine.keyframes((view: AppTheme) => ({
      to: { color: `${view.palette.primary}1F`, marginLeft: `-${view.space[2]}` },
    }))
    engine.css({ animation: `${name} 1s` })
    expect(sheet.rules.filter((rule) => rule.startsWith('@keyframes'))).toEqual([
      `@keyframes ${name}{100%{color:${MIX};margin-left:calc(var(--e-space-2) * -1);}}`,
    ])
  })

  it('names the same keyframes with the option on and off', () => {
    const steps = (view: AppTheme) => ({ to: { color: `${view.palette.primary}80` } })
    expect(setup({ hasValueRepair: true }).engine.keyframes(steps)).toBe(
      setup().engine.keyframes(steps)
    )
  })

  it('is part of the stamp only when it is on', () => {
    expect(setup({ hasValueRepair: true }).engine.cache.fingerprint).toContain(';f=1;v=1;t=')
    expect(setup().engine.cache.fingerprint).not.toContain('v=')
  })
})

describe('hasValueRepair in an engine: a reference followed by a unit', () => {
  const unitTheme = {
    fontSizes: [12, 14],
    sizes: { header: '3.5rem' },
    layout: { gutter: 3, inset: 'auto' },
  }

  it('reads the unit of each token from its declared value: the same unit, a plain number, another one', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'u', sheet, hasLayers: false, hasDevChecks: true })
    const engine = createEngine(unitTheme, { cache, hasValueRepair: true })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { fontSizes, sizes, layout } = engine.refs
    const className = engine.css({
      fontSize: `${fontSizes[0]}px`,
      height: `${sizes.header}rem`,
      marginTop: `${layout.gutter}px`,
      width: `${sizes.header}px`,
      left: `${layout.inset}px`,
    })
    expect(sheet.rules).toEqual([
      `.${className}{font-size:var(--u-font-sizes-0);height:var(--u-sizes-header);margin-top:calc(var(--u-layout-gutter) * 1px);width:var(--u-sizes-header)px;left:var(--u-layout-inset)px;}`,
    ])
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      `[u] .${className} declares width:var(--u-sizes-header)px, which puts "px" after var(--u-sizes-header), whose value 3.5rem has another unit: it is left as it is, and the browser drops it. Write the value in px, or the reference alone.`,
      `[u] .${className} declares left:var(--u-layout-inset)px, which puts "px" after var(--u-layout-inset), whose value auto is not a number: it is left as it is, and the browser drops it. Write the reference alone.`,
    ])
    warn.mockRestore()
  })

  it('repairs global rules and keyframes steps the same way', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'u', sheet, hasLayers: false })
    const engine = createEngine(unitTheme, { cache, hasValueRepair: true })
    const { fontSizes } = engine.refs
    const [set] = engine.resolveGlobal({ body: { fontSize: `${fontSizes[1]}px` } })
    expect(set.rules).toEqual(['body{font-size:var(--u-font-sizes-1);}'])
    const grow = engine.keyframes((view) => ({ to: { fontSize: `${view.fontSizes[1]}px` } }))
    engine.insertKeyframes(grow)
    expect(sheet.rules).toContain(`@keyframes ${grow}{100%{font-size:var(--u-font-sizes-1);}}`)
  })
})
