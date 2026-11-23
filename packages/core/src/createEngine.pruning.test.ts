import { createCache, createDomSheet, createMemorySheet } from './cache'
import { createEngine, createLazyEngine } from './createEngine'
import { createStyleTag } from './extractStyles'

afterEach(() => {
  document.head.innerHTML = ''
})

const theme = {
  palette: { primary: '#0000ff', accent: '#ff0000', surface: '#ffffff', text: '#111111' },
  space: [0, 4, 8],
  zIndex: { modal: 100 },
  breakpoints: { md: '600px' },
}

type AppTheme = typeof theme

const card = ({ theme: view }: { theme: AppTheme }) => ({
  color: view.palette.primary,
  background: view.palette.accent,
  zIndex: view.zIndex.modal,
  padding: view.space[1],
})

function setup(options: Parameters<typeof createEngine>[1] = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({
    prefix: 'e',
    hasLayers: false,
    sheet,
    hasPruning: options.hasPruning,
  })
  const engine = createEngine<AppTheme>(theme, { prefix: 'e', cache, ...options })
  return { engine, sheet, cache }
}

const dark = { palette: { primary: '#8ab4f8', surface: '#000000' } }

describe('the generated rules of each token mode', () => {
  it('writes a variable, a variable with a fallback, and a real value', () => {
    const { engine, sheet } = setup({
      modes: { zIndex: 'inline', 'palette.accent': 'reference' },
    })
    const className = engine.createStyler({}, [card]).getClassName({})
    expect(sheet.rules).toContain(
      `.${className}{color:var(--e-palette-primary);background:var(--e-palette-accent, #ff0000);z-index:100;padding:var(--e-space-1);}`
    )
  })

  it('declares the variable and the reference tokens, and not the inline and raw ones', () => {
    const { engine, cache } = setup({
      modes: { zIndex: 'inline', 'palette.accent': 'reference', 'palette.text': 'raw' },
    })
    const name = engine.themeId(theme)
    engine.createStyler({}, [card]).getClassName({})
    expect(cache.getRules(name)).toEqual([
      `.${name}{--e-palette-primary:#0000ff;--e-palette-accent:#ff0000;--e-space-1:4px;}`,
    ])
    expect(cache.getFullRules(name)[0]).not.toContain('z-index')
    expect(cache.getFullRules(name)[0]).not.toContain('--e-palette-text')
  })

  it('lets a nested theme override a reference token as it overrides a variable', () => {
    const { engine, cache } = setup({ modes: { 'palette.primary': 'reference' } })
    const name = engine.themeId(dark)
    const className = engine.createStyler({}, [card]).getClassName(
      {},
      undefined,
      engine.createThemeView({
        ...theme,
        palette: { ...theme.palette, ...dark.palette },
      })
    )
    expect(cache.getRules(name)).toEqual([`.${name}{--e-palette-primary:#8ab4f8;}`])
    expect(cache.getRules(className)[0]).toContain('color:var(--e-palette-primary, #0000ff)')
  })

  it('follows the theme of the view for an inline token: another value is another class', () => {
    const { engine, sheet } = setup({ modes: { zIndex: 'inline' } })
    const styler = engine.createStyler({}, [card])
    const base = styler.getClassName({})
    const same = styler.getClassName({}, undefined, engine.createThemeView({ ...theme }))
    const higher = styler.getClassName(
      {},
      undefined,
      engine.createThemeView({ ...theme, zIndex: { modal: 300 } })
    )
    expect(same).toBe(base)
    expect(higher).not.toBe(base)
    expect(sheet.rules.find((rule) => rule.startsWith(`.${higher}{`))).toContain('z-index:300;')
  })

  it('keeps a variable token one class for every theme', () => {
    const { engine } = setup()
    const styler = engine.createStyler({}, [card])
    const base = styler.getClassName({})
    const nested = styler.getClassName(
      {},
      undefined,
      engine.createThemeView({ ...theme, palette: { ...theme.palette, primary: 'red' } })
    )
    expect(nested).toBe(base)
  })
})

describe('only the used variables', () => {
  it('extracts each theme class with exactly the used tokens it has a value for', () => {
    const { engine, cache } = setup()
    const base = engine.themeId(theme)
    const nested = engine.themeId(dark)
    engine.css({ color: engine.refs.palette.primary, background: engine.refs.palette.accent })
    engine.css({ margin: engine.refs.space[2] })
    const { css } = cache.extract()
    expect(css).toContain(
      `.${base}{--e-palette-primary:#0000ff;--e-palette-accent:#ff0000;--e-space-2:8px;}`
    )
    expect(css).toContain(`.${nested}{--e-palette-primary:#8ab4f8;}`)
    expect(css).not.toContain('--e-palette-text')
    expect(css).not.toContain('--e-space-1')
    expect(cache.getRules(nested)).toEqual([`.${nested}{--e-palette-primary:#8ab4f8;}`])
  })

  it('follows a token whose value refers to another variable', () => {
    const aliases = {
      palette: { blue: '#0000ff', primary: 'var(--e-palette-blue)', unused: 'red' },
    }
    const sheet = createMemorySheet()
    const engine = createEngine(aliases, {
      prefix: 'e',
      cache: createCache({ prefix: 'e', hasLayers: false, sheet }),
    })
    const name = engine.themeId(aliases)
    engine.css({ color: engine.refs.palette.primary })
    expect(engine.cache.getRules(name)).toEqual([
      `.${name}{--e-palette-primary:var(--e-palette-blue);--e-palette-blue:#0000ff;}`,
    ])
  })

  it('always declares the paths in alwaysDeclare, nothing else', () => {
    const { engine, cache } = setup({ alwaysDeclare: ['space', 'palette.text', 'zIndex'] })
    const name = engine.themeId(theme)
    expect(cache.getRules(name)).toEqual([
      `.${name}{--e-palette-text:#111111;--e-space-0:0;--e-space-1:4px;--e-space-2:8px;--e-z-index-modal:100;}`,
    ])
    expect(cache.getRules(name)[0]).not.toContain('--e-palette-primary')
  })

  it('declares alwaysDeclare tokens of a base theme that comes later, and in a nested class', () => {
    const sheet = createMemorySheet()
    const engine = createLazyEngine<AppTheme>({
      prefix: 'e',
      alwaysDeclare: ['palette.surface'],
      cache: createCache({ prefix: 'e', hasLayers: false, sheet }),
    })
    const nested = engine.themeId(dark)
    expect(engine.cache.getRules(nested)).toEqual([`.${nested}{--e-palette-surface:#000000;}`])
  })

  it('is the old output with hasPruning: false', () => {
    const pruned = setup().cache
    const full = setup({ hasPruning: false })
    const old = createCache({
      prefix: 'e',
      hasLayers: false,
      hasPruning: false,
      sheet: createMemorySheet(),
    })
    const oldEngine = createEngine(theme, { prefix: 'e', cache: old })
    const name = full.engine.themeId(dark, 'dark')
    expect(oldEngine.themeId(dark, 'dark')).toBe(name)
    expect(full.cache.getRules(name)).toEqual([
      `.${name}{--e-palette-primary:#8ab4f8;--e-palette-surface:#000000;color-scheme:dark;}`,
    ])
    full.engine.css({ color: full.engine.refs.palette.primary })
    expect(full.sheet.rules).toHaveLength(2)
    expect(full.cache.usedVariables.size).toBe(0)
    expect(pruned.hasPruning).toBe(true)
    expect(full.engine.cache.hasPruning).toBe(false)
  })

  it.each([true, false])(
    'appends the variable that a token adds later, in the browser, once and to the classes that have it, speedy %s',
    (speedy) => {
      const sheet = createDomSheet('e', undefined, { speedy })
      const cache = createCache({ prefix: 'e', hasLayers: false, sheet })
      const engine = createEngine<AppTheme>(theme, { prefix: 'e', cache })
      engine.themeId(theme)
      engine.themeId(dark)
      const rules = readPageRules
      engine.css({ color: engine.refs.palette.primary })
      engine.css({ background: engine.refs.palette.accent })
      engine.css({ background: engine.refs.palette.accent })
      const themeRules = rules().filter((rule) => rule.startsWith('.e-theme'))
      expect(themeRules).toHaveLength(3)
      expect(themeRules.filter((rule) => rule.includes('--e-palette-accent'))).toHaveLength(1)
      expect(themeRules.filter((rule) => rule.includes('8ab4f8'))).toHaveLength(1)
    }
  )
})

describe('a hydrated page', () => {
  it.each([true, false])('neither loses nor repeats a declaration, speedy %s', (speedy) => {
    const server = setup()
    const baseName = server.engine.themeId(theme)
    const darkName = server.engine.themeId(dark, 'dark')
    server.engine.css({ color: server.engine.refs.palette.primary })
    document.head.innerHTML = createStyleTag(server.cache)

    const element = document.querySelector('style') as HTMLStyleElement
    const sent = element.textContent
    const sheet = createDomSheet('e', undefined, { speedy })
    const cache = createCache({ prefix: 'e', hasLayers: false, sheet })
    const engine = createEngine<AppTheme>(theme, { prefix: 'e', cache })
    expect(engine.themeId(theme)).toBe(baseName)
    expect(engine.themeId(dark, 'dark')).toBe(darkName)
    // One token the server covered, and one it did not.
    engine.css({ color: engine.refs.palette.primary })
    const inserted = engine.css({ background: engine.refs.palette.surface })
    const rules = readPageRules()
    expect(element.textContent).toBe(sent)
    const declaring = (name: string, variable: string) =>
      rules.filter((rule) => rule.includes(`.${name}`) && rule.includes(variable))
    expect(declaring(baseName, '--e-palette-primary')).toHaveLength(1)
    expect(declaring(darkName, '--e-palette-primary')).toHaveLength(1)
    expect(declaring(baseName, '--e-palette-surface')).toHaveLength(1)
    expect(declaring(darkName, '--e-palette-surface')).toHaveLength(1)
    expect(rules.filter((rule) => rule.includes(`.${inserted}`))).toHaveLength(1)
    expect(rules.filter((rule) => rule.includes('color-scheme'))).toHaveLength(1)
  })
})

/** The text of every rule of the style elements of the prefix e that the browser took, in document order. */
function readPageRules(): string[] {
  return [...document.querySelectorAll<HTMLStyleElement>('style[data-style="e"]')].flatMap(
    (element) => [...(element.sheet?.cssRules ?? [])].map((rule) => rule.cssText)
  )
}

describe('the size of the extracted css', () => {
  /** A large theme: a few hundred tokens across palette, space and typography. */
  function createLargeTheme() {
    const palette: Record<string, string> = {}
    for (const hue of ['red', 'blue', 'green', 'amber', 'teal', 'pink', 'gray', 'violet']) {
      for (let shade = 50; shade <= 900; shade += shade < 100 ? 50 : 100) {
        palette[`${hue}${shade}`] =
          `#${(shade * 4093 + hue.length * 977).toString(16).padStart(6, '0')}`
      }
    }
    const space = Array.from({ length: 64 }, (_, index) => index * 4)
    const fontSizes = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`s${index}`, 10 + index])
    )
    const lineHeights = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`l${index}`, 1 + index / 20])
    )
    const fonts = {
      body: 'system-ui, sans-serif',
      mono: 'ui-monospace, monospace',
      heading: 'Georgia, serif',
    }
    return { palette, space, typography: { fontSizes, lineHeights, fonts } }
  }

  function measure(hasPruning: boolean) {
    const large = createLargeTheme()
    const darker = { palette: { blue500: '#101010', gray100: '#202020', red500: '#303030' } }
    const cache = createCache({ prefix: 'e', sheet: createMemorySheet(), hasPruning })
    const engine = createEngine(large, { prefix: 'e', cache, lengthKeys: ['space'] })
    engine.themeId(large)
    engine.themeId(darker, 'dark')
    const { refs } = engine
    engine.css({ color: refs.palette.blue500, background: refs.palette.gray100 })
    engine.css({ padding: refs.space[2], margin: refs.space[4] })
    engine.css({
      fontSize: refs.typography.fontSizes.s3,
      lineHeight: refs.typography.lineHeights.l2,
    })
    engine.css({ fontFamily: refs.typography.fonts.body, borderColor: refs.palette.red500 })
    engine.css({ gap: refs.space[8], color: refs.palette.blue500 })
    const css = cache.extract().css
    return {
      bytes: new TextEncoder().encode(css).length,
      css,
      count: Object.keys(createLargeTheme().palette).length,
    }
  }

  it('is a small part of the full declarations with pruning', () => {
    const pruned = measure(true)
    const full = measure(false)
    expect(pruned.count).toBeGreaterThan(50)
    expect(pruned.css).not.toContain('--e-palette-teal500')
    expect(full.css).toContain('--e-palette-teal500')
    expect(pruned.bytes).toBeLessThan(full.bytes / 4)
  })
})

describe('edges', () => {
  it('makes a view before there is a base theme, from the theme itself', () => {
    const engine = createLazyEngine<AppTheme>({
      prefix: 'e',
      modes: { 'palette.primary': 'reference', zIndex: 'inline' },
    })
    const view = engine.createThemeView(theme)
    expect(view.palette.primary).toBe('var(--e-palette-primary, #0000ff)')
    expect(view.zIndex.modal).toBe(100)
  })

  it('makes new views when the base theme changes, as a reference falls back to the base', () => {
    const engine = createEngine<AppTheme>(theme, {
      prefix: 'e',
      modes: { 'palette.primary': 'reference' },
    })
    const real = { ...theme }
    expect(engine.createThemeView(real).palette.primary).toBe('var(--e-palette-primary, #0000ff)')
    engine.setTheme({ ...theme, palette: { ...theme.palette, primary: '#123456' } })
    expect(engine.createThemeView(real).palette.primary).toBe('var(--e-palette-primary, #123456)')
  })

  it('writes a theme class with nothing to declare as no rule, with no pruning', () => {
    const cache = createCache({ prefix: 'e', hasPruning: false, sheet: createMemorySheet() })
    const engine = createEngine({ breakpoints: { md: 1 } }, { prefix: 'e', cache })
    expect(cache.getRules(engine.themeId({}))).toEqual([])
  })
})
