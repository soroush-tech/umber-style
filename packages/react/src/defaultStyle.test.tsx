import { render, screen } from '@testing-library/react'
import { createCache, createLazyEngine, createMemorySheet, isSheetEntry } from '@umber-style/core'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import { readPrefixStyle } from './ProviderScope'

const light = { palette: { primary: '#0000ff', onPrimary: '#ffffff' }, space: [0, 4, 8] }
const other = { palette: { primary: '#ff0000', onPrimary: '#000000' }, space: [0, 2, 4] }

/** A default style over an in-memory sheet, like a fresh module would be. */
function setup() {
  const sheet = createMemorySheet()
  const cache = createCache({ hasLayers: false, hasPruning: false, prefix: 'd', sheet })
  const style = createDefaultStyle()
  style.configure({ prefix: 'd', cache })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  return { ...style, sheet, cache, ruleOf }
}

describe('the default style', () => {
  it('lets styled run before any theme, and takes the tokens from the first provider', () => {
    const { styled, ThemeProvider, getEngine, ruleOf } = setup()
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    expect(getEngine().hasTheme).toBe(false)
    render(
      <ThemeProvider theme={light}>
        <Button>ok</Button>
      </ThemeProvider>
    )
    expect(getEngine().baseTheme).toBe(light)
    const { className } = screen.getByRole('button')
    expect(className).toMatch(/^d-button-root-/)
    expect(ruleOf(className)).toBe(`.${className}{color:var(--d-palette-primary);}`)
  })

  it('gives a function style an empty theme before any theme, so reading a token throws', () => {
    const { styled } = setup()
    const Button = styled('button')(({ theme }) => ({ color: theme.palette.primary }))
    const Plain = styled('button')(({ theme }) => ({ color: theme.palette ? 'blue' : 'red' }))
    render(<Plain>plain</Plain>)
    expect(screen.getByText('plain').className).toMatch(/^d-/)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Button>ok</Button>)).toThrow(TypeError)
  })

  it('nests providers: one component class, the merged real theme from useTheme', () => {
    const { styled, ThemeProvider, useTheme } = setup()
    const Button = styled('button')(({ theme }) => ({ color: theme.palette.primary }))
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return <Button>x</Button>
    }
    const { container } = render(
      <ThemeProvider theme={light}>
        <Probe />
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Probe />
        </ThemeProvider>
      </ThemeProvider>
    )
    const buttons = [...container.querySelectorAll('button')].map((button) => button.className)
    expect(new Set(buttons).size).toBe(1)
    expect(seen[0]).toEqual(light)
    expect(seen[1]).toEqual({ ...light, palette: { primary: '#ff0000', onPrimary: '#ffffff' } })
  })

  it('makes a partial theme rendered first the base, whose shape then lacks the rest', () => {
    const { ThemeProvider, getEngine } = setup()
    const partial = { palette: { primary: '#123456' } }
    render(<ThemeProvider theme={partial}>x</ThemeProvider>)
    expect(getEngine().baseTheme).toBe(partial)
    expect(getEngine().refs.palette.onPrimary).toBeUndefined()
  })

  it('keeps the first of two full themes as the shape of the tokens; each outermost provider gives its own theme', () => {
    const { ThemeProvider, useTheme, getEngine, sheet } = setup()
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    render(
      <>
        <ThemeProvider theme={light}>
          <Probe />
        </ThemeProvider>
        <ThemeProvider theme={other}>
          <Probe />
        </ThemeProvider>
      </>
    )
    expect(getEngine().baseTheme).toBe(light)
    expect(seen).toEqual([light, other])
    // Neither renders a wrapper: their themes go to :root, and make no theme class.
    expect(sheet.rules.filter((rule) => rule.startsWith('.d-theme-'))).toHaveLength(0)
  })

  it('has useStyleValue, a value named after the prefix of its cache', () => {
    const { useStyleValue } = setup()
    const Probe = () => <i>{String(useStyleValue(3, 'px')[0])}</i>
    render(<Probe />)
    expect(screen.getByText(/^var\(--d-value-\w+, 3px\)$/)).toBeTruthy()
  })

  it('has useTheme give an empty object without a provider, and the theme of configure({ theme })', () => {
    const bare = setup()
    const Probe = () => <i>{JSON.stringify(bare.useTheme())}</i>
    render(<Probe />)
    expect(screen.getByText('{}')).toBeTruthy()

    const cache = createCache({ hasLayers: false, prefix: 'e', sheet: createMemorySheet() })
    const configured = createDefaultStyle()
    configured.configure({ cache, theme: light })
    const Reader = () => <i>{configured.useTheme().palette.primary}</i>
    render(<Reader />)
    expect(screen.getByText('#0000ff')).toBeTruthy()
  })

  it('gives a tree with no provider the empty theme after a provider with a theme unmounted', () => {
    const { styled, ThemeProvider, useTheme, getEngine, ruleOf } = setup()
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    const Box = styled('p')(({ theme }) => ({ color: theme.palette ? 'red' : 'blue' }))
    const { unmount } = render(
      <ThemeProvider theme={light}>
        <Probe />
      </ThemeProvider>
    )
    unmount()
    render(
      <>
        <Probe />
        <Box data-testid="box" />
      </>
    )
    expect(seen).toEqual([light, {}])
    const { className } = screen.getByTestId('box')
    expect(ruleOf(className)).toBe(`.${className}{color:blue;}`)
    // The engine keeps the shape of the tokens that the provider gave it; it is not a given theme.
    expect([getEngine().baseTheme, getEngine().givenTheme]).toEqual([light, undefined])
  })

  it('makes keyframes and global styles before configure, and writes them through Global with no theme', () => {
    const style = createDefaultStyle()
    const fade = style.keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const reset = style.globalStyles({ body: { margin: 0, animation: `${fade} 1s` } })
    const sheet = createMemorySheet()
    style.configure({ prefix: 'k', cache: createCache({ hasLayers: false, prefix: 'k', sheet }) })
    expect(style.getEngine().hasTheme).toBe(false)
    const { unmount } = render(<style.Global styles={reset} />)
    const keyframesRule = `@keyframes ${fade}{0%{opacity:0;}}`
    expect(sheet.rules).toEqual([keyframesRule, `body{margin:0;animation:${fade} 1s;}`])
    unmount()
    expect(sheet.rules).toEqual([keyframesRule])
  })

  it('makes css() values and template keyframes before configure, with the options given later', () => {
    const style = createDefaultStyle()
    const card = style.css({ padding: 8 })
    const loud = style.css`
      ${card}
      color: red;
    `
    const fade = style.keyframes`from { opacity: 0; }`
    const sheet = createMemorySheet()
    style.configure({ prefix: 'late', cache: createCache({ prefix: 'late', sheet }) })
    expect(isSheetEntry(loud)).toBe(true)
    expect(fade).toBe(style.keyframes({ from: { opacity: 0 } }))
    const Box = style.styled('div')({ margin: 0 })
    render(<Box data-testid="box" style={loud} />)
    const [, override] = screen.getByTestId('box').className.split(' ')
    expect(override).toMatch(/^late-/)
    expect(sheet.rules).toContain(`@layer late-overrides{.${override}{padding:8px;color:red;}}`)
    expect(String(card)).toMatch(/^late-/)
    expect([loud.styles, loud.name]).toEqual(['padding:8px;color:red;', loud.className])
  })

  it('has its tag shorthands as own members: copying them uses nothing, so configure still works', () => {
    const style = createDefaultStyle()
    const wrapper = Object.assign(() => null, style.styled)
    expect(typeof wrapper.div).toBe('function')
    const sheet = createMemorySheet()
    style.configure({ prefix: 'late', cache: createCache({ prefix: 'late', sheet }) })
    const Box = wrapper.div({ margin: 0 })
    render(<Box data-testid="copied" />)
    expect(screen.getByTestId('copied').className).toMatch(/^late-/)
    const made = createStyle(light, { prefix: 'own', cache: createCache({ prefix: 'own' }) })
    const Own = Object.assign(() => null, made.styled).em({ margin: 0 })
    render(<Own data-testid="own" />)
    expect(screen.getByTestId('own').className).toMatch(/^own-/)
  })

  it('throws from configure once the default style was used', () => {
    const { configure, getEngine } = setup()
    getEngine()
    expect(() => configure({ prefix: 'late' })).toThrow('before the default style is used')
  })

  it('shares the engine it is configured with', () => {
    const engine = createLazyEngine({
      prefix: 's',
      cache: createCache({ hasLayers: false, prefix: 's', sheet: createMemorySheet() }),
    })
    const first = createDefaultStyle()
    first.configure({ engine, theme: light })
    const second = createDefaultStyle()
    second.configure({ engine })
    expect(first.getEngine()).toBe(engine)
    expect(second.getEngine()).toBe(engine)
    expect(engine.baseTheme).toBe(light)
    expect(first.themeClass(other)).toBe(second.themeClass(other))
  })

  it('has a sheet, useStyle, apply and themeClass', () => {
    const { StyleSheet, useStyle, apply, themeClass, when, whenScheme, getEngine, ruleOf } = setup()
    getEngine().setTheme(light)
    const sheet = StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    const Box = () => <div {...apply(useStyle(sheet).box)}>box</div>
    render(<Box />)
    const { className } = screen.getByText('box')
    expect(ruleOf(className)).toBe(`.${className}{color:var(--d-palette-primary);}`)
    expect(apply()).toEqual({ className: undefined })
    expect(themeClass(light, 'dark')).toMatch(/^d-theme-[a-z0-9]+ d-boundary d-scheme-dark$/)
    expect(when(light)).toBe(`@theme ${getEngine().themeId(light)}`)
    expect(whenScheme('light')).toBe('@scheme light')
  })
})

describe('the contexts of the prefix of the default style', () => {
  // A provider of the server build finds the contexts of its prefix with no engine: the default style
  // claims the prefix it will have, read from its options until it is first used.
  it('claims the prefix of its options and gives their base theme, before it is used', () => {
    const style = createDefaultStyle()
    style.configure({ prefix: 'claim-a', theme: light })
    const found = readPrefixStyle('claim-a')
    expect(found.contexts.ThemeContext).toBe(style.ThemeContext)
    expect(found.holder?.givenTheme).toBe(light)
    expect(readPrefixStyle('claim-a')).toBe(found)
  })

  it('reads the prefix of the cache or of the engine it is given, and the base theme of that engine', () => {
    const fromCache = createDefaultStyle()
    fromCache.configure({ cache: createCache({ prefix: 'claim-b', sheet: createMemorySheet() }) })
    expect(readPrefixStyle('claim-b').contexts.ThemeContext).toBe(fromCache.ThemeContext)
    expect(readPrefixStyle('claim-b').holder?.givenTheme).toBeUndefined()
    const engine = createLazyEngine({ prefix: 'claim-c' })
    engine.setTheme(other)
    const fromEngine = createDefaultStyle()
    fromEngine.configure({ engine })
    expect(readPrefixStyle('claim-c').contexts.ThemeContext).toBe(fromEngine.ThemeContext)
    expect(readPrefixStyle('claim-c').holder?.givenTheme).toBe(other)
  })

  it('claims css with no options, and the prefix and base theme of its engine once used', () => {
    const style = createDefaultStyle()
    expect(readPrefixStyle('claim-none').contexts.ThemeContext).not.toBe(style.ThemeContext)
    style.configure({ prefix: 'claim-d' })
    style.getEngine().setTheme(light)
    expect(readPrefixStyle('claim-d').contexts.ThemeContext).toBe(style.ThemeContext)
    expect(readPrefixStyle('claim-d').holder?.givenTheme).toBe(light)
  })

  it('shares the contexts of a prefix with each createStyle of that prefix', () => {
    const style = createDefaultStyle()
    style.configure({ prefix: 'claim-e' })
    const own = createStyle(light, { prefix: 'claim-e' })
    expect(own.ThemeContext).toBe(style.ThemeContext)
    expect(createStyle(other, { prefix: 'claim-f' }).ThemeContext).toBe(
      createStyle(light, { prefix: 'claim-f' }).ThemeContext
    )
    expect(readPrefixStyle('claim-f').holder?.givenTheme).toBe(other)
  })
})

describe('createStyle', () => {
  it('gives a lazy engine the theme, and keeps the theme of an engine that has one', () => {
    const cache = createCache({ hasLayers: false, prefix: 'c', sheet: createMemorySheet() })
    const engine = createLazyEngine<typeof light>({ cache })
    const style = createStyle(light, { engine })
    expect(engine.baseTheme).toBe(light)
    expect(style.engine).toBe(engine)
    createStyle(other, { engine })
    expect(engine.baseTheme).toBe(light)
  })
})
