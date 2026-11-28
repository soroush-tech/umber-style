import { createApp, h, type Component } from 'vue'
import { createCache, createMemorySheet, type Theme } from '@umber-style/core'
import { createStyle } from './createStyle'
import type { SheetEntry, ThemedEntry } from './types'
import { createDefaultStyle } from './defaultStyle'

const baseTheme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

function setup(options: { hasBaseClass?: boolean } = {}) {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, {
    prefix: 'v',
    cache: createCache({ hasPruning: false, prefix: 'v', sheet, ...options }),
  })
  const rules = () => sheet.rules.filter((rule) => !rule.startsWith('@layer v-theme,'))
  return { ...style, sheet, rules }
}

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

const gap = ({ gap: value }: Record<string, unknown>) => ({ gap: value as number | undefined })

describe('a styled component in Vue with a base class and a props class', () => {
  it('renders base, props: the fixed styles once, the rest for each distinct result', () => {
    const { styled, rules } = setup()
    const Flex = styled('div', { name: 'Flex' })({ display: 'flex' }, gap)
    const a = mount(() => h(Flex, { gap: 4 })).firstElementChild?.className.split(' ') ?? []
    const b = mount(() => h(Flex, { gap: 8 })).firstElementChild?.className.split(' ') ?? []
    expect(a[0]).toBe(b[0])
    expect(a[1]).not.toBe(b[1])
    expect(rules()).toEqual([
      `@layer v-components{.${a[0]}{display:flex;}}`,
      `@layer v-components{.${a[1]}{gap:4px;}}`,
      `@layer v-components{.${b[1]}{gap:8px;}}`,
    ])
  })

  it('has the old output without hasBaseClass', () => {
    const { styled, rules } = setup({ hasBaseClass: false })
    const Flex = styled('div', { name: 'Flex' })({ display: 'flex' }, gap)
    const a = mount(() => h(Flex, { gap: 4 })).firstElementChild?.className ?? ''
    expect(a.split(' ')).toHaveLength(1)
    expect(rules()).toEqual([`@layer v-components{.${a}{display:flex;gap:4px;}}`])
  })
})

describe('a sheet entry given alone to the style of a component in Vue', () => {
  it('is the class of the element as it is, also after Vue merged the style array', () => {
    const { styled, StyleSheet, rules } = setup()
    const sheet = StyleSheet.create({ danger: { color: 'red' }, wide: { width: 3 } })
    const One = styled('div', { name: 'One' })({ margin: 1 })
    const Two = styled('p', { name: 'Two' })({ margin: 2 })
    const a = mount(() => h(One, { style: sheet.danger })).firstElementChild as HTMLElement
    const b = mount(() => h(Two, { style: [sheet.danger] })).firstElementChild as HTMLElement
    expect(a.className.split(' ')[1]).toBe(b.className.split(' ')[1])
    expect(a.hasAttribute('style')).toBe(false)
    const overrides = rules().filter((rule) => rule.startsWith('@layer v-overrides{'))
    expect(overrides).toEqual([`@layer v-overrides{.${a.className.split(' ')[1]}{color:red;}}`])
    const both = mount(() => h(One, { style: [sheet.danger, sheet.wide] })).firstElementChild
    expect(both?.className.split(' ')[1]).toMatch(/^v-one-root-/)
  })
})

describe('an object sheet in Vue has no hook', () => {
  it('is its entries, and useStyle returns it', () => {
    const { StyleSheet, useStyle } = setup()
    const sheet = StyleSheet.create({ box: { color: 'red' } })
    expect(useStyle(sheet)).toBe(sheet)
    expect(sheet.box.className).toMatch(/^v-/)
  })

  it('is made on first read on the default style, so a module can create it before configure', () => {
    const style = createDefaultStyle()
    const sheet = style.StyleSheet.create({ box: { color: 'red' } })
    expect(() =>
      style.configure({ prefix: 'late', theme: baseTheme as unknown as Theme })
    ).not.toThrow()
    expect(sheet.box.className).toMatch(/^late-/)
    expect(style.useStyle(sheet)).toEqual(sheet)
  })
})

describe('the types of a sheet in Vue', () => {
  it('gives entries for an object and a sheet for a function of the theme, which has none', () => {
    const { StyleSheet, apply, useStyle } = setup()
    const object = StyleSheet.create({ box: { color: 'red' } })
    const themed = StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    expectTypeOf(object).toEqualTypeOf<{ readonly box: SheetEntry }>()
    expectTypeOf(apply(object.box)).toEqualTypeOf<{ class?: string }>()
    expectTypeOf(useStyle(object)).toEqualTypeOf<{ readonly box: SheetEntry }>()
    expectTypeOf(useStyle(themed)).toEqualTypeOf<{ box: SheetEntry }>()
    // Each name is a handle, which the style of a styled component resolves with its theme.
    expectTypeOf(themed.box).toEqualTypeOf<ThemedEntry>()
    // @ts-expect-error it is not an entry, so it is not given to apply
    expect(apply(themed)).toBeDefined()
    // @ts-expect-error an entry alone is not a sheet
    expect(useStyle(object.box)).toBeDefined()
  })
})
