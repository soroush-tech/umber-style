import { createApp, defineComponent, h, nextTick, ref, type Component } from 'vue'
import {
  createCache,
  createLazyEngine,
  createMemorySheet,
  NO_THEME_MESSAGE,
} from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle'

const baseTheme = {
  palette: { primary: '#0000ff', text: '#111111' },
  space: { small: 4 },
}

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, {
    prefix: 'p',
    cache: createCache({ prefix: 'p', sheet }),
  })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  return { ...style, sheet, ruleOf }
}

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

describe('a ThemeProvider whose theme changes', () => {
  it('updates the real theme of a consumer and the class of its element', async () => {
    const { ThemeProvider, useTheme: readTheme } = setup()
    const theme = ref<Record<string, unknown>>({ palette: { primary: '#ff0000' } })
    const Consumer = defineComponent({
      setup() {
        const real = readTheme()
        return () => h('i', real.value.palette.primary)
      },
    })
    const root = mount(() => h(ThemeProvider, { theme: theme.value }, () => h(Consumer)))
    const wrapper = root.firstElementChild as HTMLElement
    const before = wrapper.className
    expect(root.querySelector('i')?.textContent).toBe('#ff0000')

    theme.value = { palette: { primary: '#00ff00' } }
    await nextTick()
    expect(root.querySelector('i')?.textContent).toBe('#00ff00')
    expect(wrapper.className).not.toBe(before)
  })

  it('merges a nested provider over the outer one, reactively', async () => {
    const { ThemeProvider, useTheme: readTheme } = setup()
    const outer = ref({ space: { small: 1 } })
    const Consumer = defineComponent({
      setup() {
        const real = readTheme()
        return () => h('i', `${real.value.palette.primary} ${real.value.space.small}`)
      },
    })
    const root = mount(() =>
      h(ThemeProvider, { theme: outer.value }, () =>
        h(ThemeProvider, { theme: { palette: { primary: '#ff0000' } } }, () => h(Consumer))
      )
    )
    expect(root.querySelector('i')?.textContent).toBe('#ff0000 1')
    outer.value = { space: { small: 2 } }
    await nextTick()
    expect(root.querySelector('i')?.textContent).toBe('#ff0000 2')
  })

  it('renders the element of `as` and keeps a given class', () => {
    const { ThemeProvider } = setup()
    const root = mount(() => h(ThemeProvider, { theme: {}, as: 'section', class: 'mine' }))
    const element = root.firstElementChild as HTMLElement
    expect(element.tagName).toBe('SECTION')
    expect(element.className).toMatch(/^p-theme-[a-z0-9]+ p-scope mine$/)
  })
})

describe('useTheme without a provider', () => {
  it('returns the base theme, and throws without one', () => {
    const { useTheme: readTheme } = setup()
    let seen: unknown
    mount(
      defineComponent({
        setup() {
          seen = readTheme().value
          return () => null
        },
      })
    )
    expect(seen).toEqual(baseTheme)

    const empty = bindEngine(createLazyEngine({ prefix: 'z' }))
    mount(
      defineComponent({
        setup() {
          const value = empty.useTheme()
          expect(() => value.value).toThrow(NO_THEME_MESSAGE)
          return () => null
        },
      })
    )
  })
})

describe('StyleSheet, useStyle and apply', () => {
  it('makes classes from a sheet and applies them as a class', () => {
    const { StyleSheet, useStyle, apply, ruleOf } = setup()
    const sheet = StyleSheet.create((theme) => ({
      box: { color: theme.palette.primary },
      text: { margin: 1 },
    }))
    const classes = useStyle(sheet)
    expect(ruleOf(classes.box.className)).toBe(
      `.${classes.box.className}{color:var(--p-palette-primary);}`
    )
    expect(apply(classes.box, null, classes.text, false)).toEqual({
      class: expect.stringMatching(/^p-[a-z0-9]+$/),
    })
    expect(apply()).toEqual({ class: undefined })
  })
})

describe('styling a styled component', () => {
  it('flattens into one element with the inner styles first', () => {
    const { styled, ruleOf } = setup()
    const Base = styled('button', { name: 'Base', shouldForwardProp: (prop) => prop !== 'tone' })({
      color: 'red',
    })
    const Fancy = styled(Base, { name: 'Fancy' })({ margin: 4 })
    const root = mount(() => h(Fancy, { tone: 'x', title: 't' }, () => 'hi'))
    expect(root.querySelectorAll('*')).toHaveLength(1)
    const button = root.querySelector('button') as HTMLElement
    expect(button.className).toMatch(/^p-fancy-root-/)
    expect(ruleOf(button.className)).toBe(`.${button.className}{color:red;margin:4px;}`)
    expect(button.hasAttribute('tone')).toBe(false)
    expect(button.getAttribute('title')).toBe('t')
    expect(Fancy._tag).toBe('button')
    expect(Fancy._styles).toHaveLength(4)
  })
})

describe('createStyle and bindEngine with an engine', () => {
  it('gives a lazy engine the theme, and keeps the theme of an engine that has one', () => {
    const engine = createLazyEngine<typeof baseTheme>({
      cache: createCache({ prefix: 'c', sheet: createMemorySheet() }),
    })
    const style = createStyle(baseTheme, { engine })
    expect(engine.baseTheme).toBe(baseTheme)
    expect(style.engine).toBe(engine)
    const other = { palette: { primary: 'red', text: 'blue' }, space: { small: 1 } }
    createStyle(other, { engine })
    expect(engine.baseTheme).toBe(baseTheme)
  })

  it('takes the theme of a provider as it is while the engine has no base yet', () => {
    const engine = createLazyEngine<typeof baseTheme>({ prefix: 'q' })
    // An engine whose themeClass does not give the base, so the provider reads before there is one.
    const silent = Object.create(engine, { themeClass: { value: () => 'q-theme' } })
    const { ThemeProvider, useTheme: readTheme } = bindEngine(silent as typeof engine)
    let seen: unknown
    const Consumer = defineComponent({
      setup() {
        const real = readTheme()
        return () => {
          seen = real.value
          return null
        }
      },
    })
    mount(() => h(ThemeProvider, { theme: baseTheme }, () => h(Consumer)))
    expect(seen).toBe(baseTheme)
  })
})
