import { createApp, defineComponent, h, type Component } from 'vue'
import {
  createCache,
  createLazyEngine,
  createMemorySheet,
  NO_THEME_MESSAGE,
} from '@umber-style/core'
import { createDefaultStyle } from './defaultStyle'

const light = { palette: { primary: '#0000ff' }, space: { small: 4 } }

function setup() {
  const sheet = createMemorySheet()
  const style = createDefaultStyle()
  style.configure({ prefix: 'd', cache: createCache({ hasLayers: false, prefix: 'd', sheet }) })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  return { ...style, sheet, ruleOf }
}

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

describe('the default style', () => {
  it('lets styled run before any theme, and takes the tokens from the first provider', () => {
    const { styled, ThemeProvider, getEngine, ruleOf } = setup()
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    expect(getEngine().hasTheme).toBe(false)
    const root = mount(() => h(ThemeProvider, { theme: light, class: 'mine' }, () => h(Button)))
    expect(getEngine().baseTheme).toBe(light)
    const button = root.querySelector('button') as HTMLElement
    expect(ruleOf(button.className)).toBe(`.${button.className}{color:var(--d-palette-primary);}`)
    expect((root.firstElementChild as HTMLElement).className).toMatch(
      /^d-theme-\w+ d-boundary d-scope mine$/
    )
  })

  it('throws one clear error for a function style before any theme', () => {
    const { styled } = setup()
    const Button = styled('button')(({ theme }) => ({ color: theme.palette.primary }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() => mount(() => h(Button))).toThrow(NO_THEME_MESSAGE)
    warn.mockRestore()
  })

  it('has useTheme read the theme of configure, and throw from configure once used', () => {
    const { configure, useTheme, getEngine } = createDefaultStyle()
    configure({ theme: light })
    let seen: unknown
    mount(
      defineComponent({
        setup() {
          seen = useTheme().value
          return () => null
        },
      })
    )
    expect(seen).toBe(light)
    expect(getEngine().hasTheme).toBe(true)
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
    expect(first.themeClass({ space: { small: 1 } })).toBe(
      second.themeClass({ space: { small: 1 } })
    )
  })

  it('has a sheet, useStyle, apply and themeClass', () => {
    const { StyleSheet, useStyle, apply, themeClass, when, whenScheme, getEngine, ruleOf } = setup()
    getEngine().setTheme(light)
    const classes = useStyle(
      StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    )
    expect(ruleOf(classes.box.className)).toBe(
      `.${classes.box.className}{color:var(--d-palette-primary);}`
    )
    expect(apply(classes.box)).toEqual({ class: classes.box.className })
    expect(themeClass(light, 'dark')).toMatch(/^d-theme-[a-z0-9]+ d-boundary d-scheme-dark$/)
    expect(when(light)).toBe(`@theme ${getEngine().themeId(light)}`)
    expect(whenScheme('light')).toBe('@scheme light')
  })
})
