import { render, screen } from '@testing-library/react'
import {
  createCache,
  createLazyEngine,
  createMemorySheet,
  NO_THEME_MESSAGE,
} from '@umber-style/core'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

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

  it('throws one clear error when a function style runs before any theme', () => {
    const { styled } = setup()
    const Button = styled('button')(({ theme }) => ({ color: theme.palette.primary }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Button>ok</Button>)).toThrow(NO_THEME_MESSAGE)
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

  it('keeps the first of two full themes as the base; each root merges over it', () => {
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
    expect(sheet.rules.filter((rule) => rule.startsWith('.d-theme-'))).toHaveLength(2)
  })

  it('has useTheme throw without a provider, and return the theme of configure({ theme })', () => {
    const bare = setup()
    const Probe = () => <i>{JSON.stringify(bare.useTheme())}</i>
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Probe />)).toThrow(NO_THEME_MESSAGE)

    const cache = createCache({ hasLayers: false, prefix: 'e', sheet: createMemorySheet() })
    const configured = createDefaultStyle()
    configured.configure({ cache, theme: light })
    const Reader = () => <i>{configured.useTheme().palette.primary}</i>
    render(<Reader />)
    expect(screen.getByText('#0000ff')).toBeTruthy()
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
