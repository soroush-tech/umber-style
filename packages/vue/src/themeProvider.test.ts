import {
  createApp,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  ref,
  Teleport,
  type Component,
  type FunctionalComponent,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createCache, createMemorySheet, extractPageStyles } from '@umber-style/core'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const light = {
  palette: { primary: '#0000ff', text: '#111111' },
  breakpoints: Object.defineProperty({ values: { md: 768 } }, 'up', {
    value: (key: string) => `@media (min-width: ${key})`,
  }),
}
const dark = { palette: { primary: '#8888ff', text: '#eeeeee' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(light, {
    prefix: 'v',
    cache: createCache({ hasLayers: false, prefix: 'v', sheet }),
  })
  const roots = () => sheet.rules.filter((rule) => rule.startsWith(':where(:root)'))
  const ruleOf = (id: string) => sheet.rules.find((rule) => rule.startsWith(`.${id}{`))
  return { ...style, sheet, roots, ruleOf }
}

function mount(component: Component) {
  const element = document.createElement('div')
  document.body.appendChild(element)
  createApp(component).mount(element)
  return element
}

/** A styled component that counts its renders, inside a component with no props, which its parent does not render again. */
function createCounted(style: ReturnType<typeof setup>) {
  const renders = { count: 0 }
  const Probe: FunctionalComponent = (_props, { attrs, slots }) => {
    renders.count++
    return h('b', attrs, slots.default?.())
  }
  const Text = style.styled(Probe)(({ theme }) => ({ color: theme.palette.primary }))
  const Child = defineComponent({ setup: () => () => h(Text, null, () => 'x') })
  return { Child, renders }
}

describe('the outermost provider', () => {
  it('renders no element and puts no class on <html>: its theme is declared on :root', () => {
    const style = setup()
    const { Child } = createCounted(style)
    const root = mount(() =>
      h(style.ThemeProvider, { theme: light, colorScheme: 'dark' }, () => h(Child))
    )
    expect(root.innerHTML).toMatch(/^<b class="v-[a-z0-9]+">x<\/b>$/)
    expect(document.documentElement.className).toBe('')
    expect(style.roots()).toEqual([':where(:root){--v-palette-primary:#0000ff;color-scheme:dark;}'])
  })

  it('rewrites the :root rule when its theme changes, and renders no styled component again', async () => {
    const style = setup()
    const { Child, renders } = createCounted(style)
    const theme = ref<object>(light)
    const seen: string[] = []
    const Reader = defineComponent({
      setup() {
        const real = style.useTheme()
        return () => (seen.push(real.value.palette.primary), null)
      },
    })
    mount(() => h(style.ThemeProvider, { theme: theme.value }, () => [h(Child), h(Reader)]))
    theme.value = { ...light, ...dark }
    await nextTick()
    expect(style.roots()).toEqual([':where(:root){--v-palette-primary:#8888ff;}'])
    expect(renders.count).toBe(1)
    expect(seen).toEqual(['#0000ff', '#8888ff'])
  })

  it('has ThemeScope render its slot alone and useThemeClass give nothing, under it or with isRoot', () => {
    const style = setup()
    const seen: unknown[] = []
    const Probe = defineComponent({
      setup() {
        const scope = style.useThemeClass()
        return () => (seen.push(scope.value), h('i'))
      },
    })
    const root = mount(() => [
      h(style.ThemeProvider, { theme: light }, () => h(style.ThemeScope, null, () => h(Probe))),
      h(style.ThemeProvider, { theme: light, isRoot: true }, () =>
        h(style.ThemeScope, null, () => h(Probe))
      ),
    ])
    expect(root.innerHTML).toBe('<i></i><i></i>')
    expect(seen).toEqual([undefined, undefined])
  })

  it('shares :root with one side by side: the theme of the last one set up is there', () => {
    const style = setup()
    const { Child } = createCounted(style)
    mount(() => [
      h(style.ThemeProvider, { theme: light }, () => h(Child)),
      h(style.ThemeProvider, { theme: dark }, () => h(Child)),
    ])
    expect(style.roots()).toEqual([':where(:root){--v-palette-primary:#8888ff;}'])
  })
})

describe('a nested provider', () => {
  it('renders one wrapper under the outermost provider: the class of what it changes, and the scope', async () => {
    const style = setup()
    const { Child, renders } = createCounted(style)
    const theme = ref<object>({ palette: { primary: '#ff0000' } })
    const root = mount(() =>
      h(style.ThemeProvider, { theme: light }, () =>
        h(style.ThemeProvider, { theme: theme.value }, () => h(Child))
      )
    )
    const wrapper = root.firstElementChild as HTMLElement
    // The class of its merged theme is the class of its own theme: the outermost theme is on :root.
    const [own, boundary, scope] = wrapper.className.split(' ')
    expect([boundary, scope]).toEqual(['v-boundary', 'v-scope'])
    style.engine.css({ color: style.engine.refs.palette.text })
    expect(style.ruleOf(own)).toBe(`.${own}{--v-palette-primary:#ff0000;}`)
    const before = wrapper.className
    theme.value = { palette: { primary: '#00ff00' } }
    await nextTick()
    expect(wrapper.className).not.toBe(before)
    expect(renders.count).toBe(1)
  })

  it('gives its wrapper to ThemeScope in a teleport, and its class to useThemeClass', () => {
    const style = setup()
    const target = document.createElement('div')
    document.body.appendChild(target)
    let seen: string | undefined
    const Probe = defineComponent({
      setup() {
        const scope = style.useThemeClass()
        return () => ((seen = scope.value), h('i', 'teleported'))
      },
    })
    const root = mount(() =>
      h(style.ThemeProvider, { theme: light }, () =>
        h(style.ThemeProvider, { theme: dark, as: 'section' }, () =>
          h(
            Teleport,
            { to: target },
            h(style.ThemeScope, null, () => h(Probe))
          )
        )
      )
    )
    const wrapper = root.firstElementChild as HTMLElement
    const repeated = target.firstElementChild as HTMLElement
    expect(repeated.tagName).toBe('SECTION')
    expect(repeated.className).toBe(wrapper.className)
    expect(repeated.textContent).toBe('teleported')
    expect(seen).toBe(wrapper.className)
  })

  it('three deep, has the class of the nested themes above it and its own, merged, and never the outermost theme, through isRoot too', () => {
    const style = setup()
    style.engine.css({
      color: style.engine.refs.palette.primary,
      fill: style.engine.refs.palette.text,
    })
    const root = mount(() =>
      h(style.ThemeProvider, { theme: light }, () =>
        h(style.ThemeProvider, { theme: { palette: { text: '#00ff00' } } }, () =>
          h(style.ThemeProvider, { theme: light, isRoot: true }, () =>
            h(style.ThemeProvider, { theme: { palette: { primary: '#ff0000' } } })
          )
        )
      )
    )
    const inner = root.firstElementChild?.firstElementChild as HTMLElement
    const [own, boundary, full, scope] = inner.className.split(' ')
    expect([boundary, scope]).toEqual(['v-boundary', 'v-scope'])
    expect(style.ruleOf(own)).toBe(`.${own}{--v-palette-primary:#ff0000;}`)
    expect(style.ruleOf(full)).toBe(
      `.${full}{--v-palette-text:#00ff00;--v-palette-primary:#ff0000;}`
    )
  })

  it('declares the nested themes above it and its own when it is in teleported content', () => {
    const style = setup()
    const target = document.createElement('div')
    document.body.appendChild(target)
    mount(() =>
      h(style.ThemeProvider, { theme: light }, () =>
        h(style.ThemeProvider, { theme: dark }, () =>
          h(
            Teleport,
            { to: target },
            h(style.ThemeProvider, { theme: { palette: { text: '#ff0000' } } })
          )
        )
      )
    )
    const full = (target.firstElementChild as HTMLElement).className.split(' ')[2]
    style.engine.css({
      color: style.engine.refs.palette.primary,
      fill: style.engine.refs.palette.text,
    })
    expect(style.ruleOf(full)).toBe(
      `.${full}{--v-palette-primary:#8888ff;--v-palette-text:#ff0000;}`
    )
  })

  it('passes the wrapper above it on with isRoot', () => {
    const style = setup()
    let seen: string | undefined
    const Probe = defineComponent({
      setup() {
        const scope = style.useThemeClass()
        return () => ((seen = scope.value), null)
      },
    })
    const root = mount(() =>
      h(style.ThemeProvider, { theme: light }, () =>
        h(style.ThemeProvider, { theme: dark }, () =>
          h(style.ThemeProvider, { theme: dark, isRoot: true }, () => h(Probe))
        )
      )
    )
    expect(seen).toBe((root.firstElementChild as HTMLElement).className)
  })
})

describe('a function theme, and the helpers of a raw key', () => {
  it('gets the theme above, or the base theme; a nested provider that sets the key keeps its helpers', () => {
    const style = setup()
    const seen: (typeof light)[] = []
    const Probe = defineComponent({
      setup() {
        const real = style.useTheme()
        return () => (seen.push(real.value), null)
      },
    })
    mount(() =>
      h(
        style.ThemeProvider,
        { theme: (outer: typeof light) => ({ palette: { text: outer.palette.primary } }) },
        () =>
          h(style.ThemeProvider, { theme: { breakpoints: { values: { md: 600 } } } }, () =>
            h(Probe)
          )
      )
    )
    expect(seen[0].palette.text).toBe('#0000ff')
    expect(seen[0].breakpoints.values.md).toBe(600)
    expect((seen[0].breakpoints as unknown as { up: unknown }).up).toBe(
      (light.breakpoints as unknown as { up: unknown }).up
    )
  })
})

describe('the default style', () => {
  it('has ThemeScope and useThemeClass', () => {
    const style = createDefaultStyle()
    style.configure({
      prefix: 'dv',
      cache: createCache({ prefix: 'dv', sheet: createMemorySheet() }),
    })
    let seen: string | undefined
    const Probe = defineComponent({
      setup() {
        const scope = style.useThemeClass()
        return () => ((seen = scope.value), h('i'))
      },
    })
    const root = mount(() =>
      h(style.ThemeProvider, { theme: light as never }, () =>
        h(style.ThemeProvider, { theme: dark as never }, () =>
          h(style.ThemeScope, null, () => h(Probe))
        )
      )
    )
    const wrapper = root.firstElementChild as HTMLElement
    expect(seen).toBe(wrapper.className)
    expect(wrapper.querySelectorAll('div')).toHaveLength(1)
  })
})

describe('a server render of the outermost provider', () => {
  /** The app, with an outermost provider and a nested one. */
  function createPage() {
    const style = createStyle(light, { prefix: 'vr' })
    const Box = style.styled('div', { name: 'Box' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    const App = () =>
      h(style.ThemeProvider, { theme: light, colorScheme: 'light' }, () => [
        h(Box, null, () => 'outer'),
        h(style.ThemeProvider, { theme: dark }, () => h(Box, null, () => 'inner')),
      ])
    return { ...style, App }
  }

  it('has the :root rule in the CSS of the page, and hydrates with no warning and the same markup', async () => {
    const server = createPage()
    const html = await renderToString(createSSRApp(server.App))
    const page = extractPageStyles(server.cache, html)
    expect(page.css).toContain(
      '@layer vr-theme{:where(:root){--vr-palette-primary:#0000ff;color-scheme:light;}}'
    )
    document.head.innerHTML = page.tag
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    createSSRApp(createPage().App).mount(container)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(html)
  })
})
