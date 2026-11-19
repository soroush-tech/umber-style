import { createApp, defineComponent, h, type Component } from 'vue'
import { createCache, createLazyEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4] }

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

describe('a ThemeProvider with isRoot', () => {
  it('renders no element and no class, but gives the theme and makes its rule', () => {
    const sheet = createMemorySheet()
    const {
      ThemeProvider,
      useTheme: readTheme,
      engine,
    } = createStyle(theme, {
      prefix: 'r',
      cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'r', sheet }),
    })
    let seen: unknown
    const Probe = defineComponent({
      setup() {
        const value = readTheme()
        return () => {
          seen = value.value
          return h('i')
        }
      },
    })
    const root = mount(() =>
      h(ThemeProvider, { theme, isRoot: true }, () => [
        h(Probe),
        h(ThemeProvider, { theme: { space: [0, 8] } }, () => h('b')),
      ])
    )
    expect(root.firstElementChild?.tagName).toBe('I')
    expect(root.children).toHaveLength(2)
    expect(root.children[1].className).toMatch(/^r-theme-/)
    expect(seen).toEqual(theme)
    expect(sheet.rules).toContain(
      `.${engine.themeId(theme)}{--r-palette-primary:#0000ff;--r-space-0:0;--r-space-1:4px;}`
    )
  })
})

describe('the wrapper of a ThemeProvider', () => {
  it('has only classes, and computes display: contents, which a theme class alone does not set', () => {
    const { ThemeProvider, themeClass } = createStyle(theme, { prefix: 'dc' })
    const root = mount(() => h(ThemeProvider, { theme }, () => h('i')))
    document.body.append(root)
    const wrapper = root.firstElementChild as HTMLElement
    expect(wrapper.hasAttribute('style')).toBe(false)
    expect(getComputedStyle(wrapper).display).toBe('contents')

    const plain = document.createElement('div')
    plain.className = themeClass(theme)
    document.body.append(plain)
    expect(getComputedStyle(plain).display).not.toBe('contents')
  })
})

describe('a ThemeProvider with isRoot and a color scheme of its own', () => {
  it('makes no theme rule and no class: the app made the one it uses with themeClass', () => {
    const sheet = createMemorySheet()
    const { ThemeProvider, themeClass } = createStyle(theme, {
      prefix: 'r',
      cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'r', sheet }),
    })
    themeClass(theme, 'light')
    const before = [...sheet.rules]
    expect(before).toHaveLength(1)
    const root = mount(() =>
      h(ThemeProvider, { theme, colorScheme: 'dark', isRoot: true }, () => h('i'))
    )
    expect(sheet.rules).toEqual(before)
    expect(root.innerHTML).toBe('<i></i>')
  })

  it('still gives the engine its base theme, when the engine had none', () => {
    const sheet = createMemorySheet()
    const engine = createLazyEngine<typeof theme>({
      prefix: 'r',
      cache: createCache({ hasLayers: false, prefix: 'r', sheet }),
    })
    const { ThemeProvider } = bindEngine(engine)
    expect(engine.hasTheme).toBe(false)
    mount(() => h(ThemeProvider, { theme, isRoot: true }, () => h('i')))
    expect(engine.baseTheme).toBe(theme)
    expect(sheet.rules).toEqual([])
  })
})
