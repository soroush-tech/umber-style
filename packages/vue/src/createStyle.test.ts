import { createApp, defineComponent, h, type Component } from 'vue'
import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const baseTheme = {
  palette: { primary: '#0000ff', text: '#111111' },
  space: { small: 4 },
}

function setup(prefix = 'v') {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, {
    prefix,
    cache: createCache({ hasLayers: false, prefix, sheet }),
  })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  return { ...style, sheet, ruleOf }
}

/** Mounts `component` into a new element. */
function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

describe('styled', () => {
  it('renders the tag with a labeled class and the theme as variable references', () => {
    const { styled, sheet } = setup()
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    const element = mount(() => h(Button, null, () => 'hi'))
    const button = element.querySelector('button') as HTMLElement
    expect(button.textContent).toBe('hi')
    expect(button.className).toMatch(/^v-button-root-[a-z0-9]+$/)
    expect(sheet.rules.join('')).toContain('color:var(--v-palette-primary);')
  })

  it('renders no class attribute when there is nothing to put in it', () => {
    const { styled } = setup()
    const Empty = styled('span')()
    expect(
      mount(() => h(Empty))
        .querySelector('span')
        ?.hasAttribute('class')
    ).toBe(false)
  })

  it('merges its class with the one it is given, in any form: one engine class, the later wins', () => {
    const { styled, cache, ruleOf } = setup()
    const Box = styled('div')({ color: 'red', margin: 4 })
    const other = cache.css({ color: 'blue' })
    const forms = [`${other} external`, [other, 'external'], { [other]: true, external: true }]
    for (const form of forms) {
      const div = mount(() => h(Box, { class: form })).querySelector('div') as HTMLElement
      const classes = div.className.split(' ')
      expect(classes).toHaveLength(2)
      expect(classes).toContain('external')
      const engineClass = classes.find((name) => name.startsWith('v-')) as string
      expect(ruleOf(engineClass)).toBe(`.${engineClass}{margin:4px;color:blue;}`)
    }
  })

  it('gives function styles the attributes, and the same class for the same attributes', () => {
    const { styled } = setup()
    const Box = styled('div')(({ size }) => ({ padding: size as number | undefined }))
    const root = mount(() =>
      h('div', null, [h(Box, { size: 4 }), h(Box, { size: 4 }), h(Box, { size: 8 })])
    )
    const [first, second, third] = [...(root.firstElementChild as Element).children].map(
      (box) => box.className
    )
    expect(second).toBe(first)
    expect(third).not.toBe(first)
  })

  it('forwards attributes and listeners to a tag, but `as`, `theme` and `class`', () => {
    const { styled } = setup()
    const onClick = vi.fn()
    const Button = styled('button')({ color: 'red' })
    const button = mount(() =>
      h(Button, { onClick, 'data-x': '1', theme: {}, id: 'a' })
    ).querySelector('button') as HTMLElement
    expect(button.getAttributeNames().sort()).toEqual(['class', 'data-x', 'id'])
    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the element of `as`', () => {
    const { styled } = setup()
    const Button = styled('button')({ color: 'red' })
    const root = mount(() => h(Button, { as: 'a', href: '#top' }))
    expect(root.querySelector('a')?.getAttribute('href')).toBe('#top')
    expect(root.querySelector('button')).toBeNull()
  })

  it('uses shouldForwardProp for a tag only', () => {
    const { styled } = setup()
    const Box = styled('div', { shouldForwardProp: (prop) => prop === 'id' })({ color: 'red' })
    const div = mount(() => h(Box, { id: 'a', title: 'b' })).querySelector('div') as HTMLElement
    expect(div.getAttributeNames().sort()).toEqual(['class', 'id'])

    const seen: Record<string, unknown>[] = []
    const Probe = defineComponent({
      inheritAttrs: false,
      setup:
        (_props, { attrs }) =>
        () => {
          seen.push({ ...attrs })
          return h('i')
        },
    })
    const Wrapped = styled(Probe, { shouldForwardProp: () => false })({ color: 'red' })
    mount(() => h(Wrapped, { id: 'a', theme: {} }))
    expect(Object.keys(seen[0]).sort()).toEqual(['class', 'id'])
  })

  it('passes its slots on to a component', () => {
    const { styled } = setup()
    const Probe = defineComponent({
      setup:
        (_props, { slots }) =>
        () =>
          h('p', slots.default?.()),
    })
    const Wrapped = styled(Probe)({ color: 'red' })
    expect(mount(() => h(Wrapped, null, () => 'inside')).querySelector('p')?.textContent).toBe(
      'inside'
    )
  })
})

describe('ThemeProvider and useTheme', () => {
  it('nests: one component class, a class for each theme, and the merged real theme', () => {
    const { styled, ThemeProvider, useTheme: readTheme, sheet } = setup()
    const Button = styled('button')(({ theme }) => ({ color: theme.palette.primary }))
    const seen: unknown[] = []
    const Probe = defineComponent({
      setup() {
        const theme = readTheme()
        return () => {
          seen.push(theme.value)
          return h(Button, null, () => 'x')
        }
      },
    })
    const root = mount(() =>
      h('div', null, [
        h(Probe),
        h(ThemeProvider, { theme: { palette: { primary: '#ff0000' } }, class: 'mine' }, () => [
          h(ThemeProvider, { theme: { space: { small: 8 } }, colorScheme: 'dark' }, () => h(Probe)),
        ]),
      ])
    )
    expect(seen[0]).toEqual(baseTheme)
    expect(seen[1]).toEqual({
      palette: { primary: '#ff0000', text: '#111111' },
      space: { small: 8 },
    })
    const outer = root.querySelector('[class*="v-theme-"]') as HTMLElement
    expect(outer.className).toMatch(/^v-theme-[a-z0-9]+ v-boundary v-scope mine$/)
    expect(root.querySelectorAll('[style]')).toHaveLength(0)
    const buttons = [...root.querySelectorAll('button')].map((button) => button.className)
    expect(new Set(buttons).size).toBe(1)
    expect(sheet.rules.filter((rule) => rule.startsWith('.v-theme-'))).toHaveLength(2)
    expect(sheet.rules.join('')).toContain('color-scheme:dark;')
  })

  it('renders an empty element without a default slot', () => {
    const { ThemeProvider } = setup()
    const root = mount(() => h(ThemeProvider, { theme: {} }))
    expect(root.firstElementChild?.childNodes).toHaveLength(0)
  })
})

describe('createStyle', () => {
  it('exposes the engine, its cache and themeClass', () => {
    const style = createStyle(baseTheme, { prefix: 'my' })
    expect(style.cache).toBe(style.engine.cache)
    expect(style.themeClass({})).toMatch(/^my-theme-/)
    expect(style.cache.prefix).toBe('my')
  })

  it('shares an engine, and so the class of a theme', () => {
    const engine = createEngine(baseTheme, {
      prefix: 's',
      cache: createCache({ hasLayers: false, prefix: 's', sheet: createMemorySheet() }),
    })
    const first = createStyle(baseTheme, { engine })
    const second = createStyle(baseTheme, { engine })
    expect(first.engine).toBe(engine)
    expect(first.themeClass({ space: { small: 1 } })).toBe(
      second.themeClass({ space: { small: 1 } })
    )
  })
})
