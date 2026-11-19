import { at, createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { createApp, h } from 'vue'
import { bindEngine } from './createStyle'

const base = { palette: { primary: '#0000ff' } }
const dark = { palette: { primary: '#8888ff' } }

describe('theme conditions in Vue', () => {
  it('follows the web: the scoped rule of the theme, and the boundary on the provider element', () => {
    const sheet = createMemorySheet()
    const engine = createEngine(base, { prefix: 'v', cache: createCache({ prefix: 'v', sheet }) })
    const { styled, ThemeProvider, when, whenScheme } = bindEngine(engine)
    const Card = styled('div')({
      border: 'none',
      ...at(when(dark, 'dark'), { border: '1px solid white' }),
      ...at(whenScheme('dark'), { boxShadow: 'none' }),
    })
    const root = document.createElement('div')
    createApp(() => h(ThemeProvider, { theme: dark, colorScheme: 'dark' }, () => h(Card))).mount(
      root
    )
    const wrapper = root.firstElementChild as HTMLElement
    expect(wrapper.className).toBe(`${engine.themeClass(dark, 'dark')} v-scope`)
    const card = wrapper.firstElementChild?.className as string
    expect(sheet.rules).toContain(
      `@layer v-components{@scope (.${engine.themeId(dark, 'dark')}) to (.v-boundary){.${card}{border:1px solid white;}}}`
    )
    expect(sheet.rules.some((rule) => rule.includes('@media (prefers-color-scheme: dark)'))).toBe(
      true
    )
  })
})
