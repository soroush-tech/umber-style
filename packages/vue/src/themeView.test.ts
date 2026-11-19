import { createApp, defineComponent, h, type Component } from 'vue'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = {
  palette: { primary: '#0000ff' },
  space: [0, 4, 8],
  breakpoints: ['900px'],
}

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, {
    prefix: 'b',
    cache: createCache({ hasLayers: false, prefix: 'b', sheet }),
  })
  const rulesOf = (className: string) =>
    sheet.rules.filter((rule) => rule.includes(`.${className}`))
  return { ...style, sheet, rulesOf }
}

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

describe('function styles read the real theme of the nearest provider', () => {
  it('puts the breakpoint of each provider in its own media rule, with its own class', () => {
    const { styled, ThemeProvider, rulesOf } = setup()
    const Box = styled('div')(({ theme: view }) => ({
      color: view.palette.primary,
      [`@media (width >= ${view.breakpoints[0]})`]: { padding: view.space[1] },
    }))
    const root = mount(() =>
      h(ThemeProvider, { theme }, () => [
        h(Box, { id: 'outer' }),
        h(ThemeProvider, { theme: { breakpoints: ['500px'] } }, () => h(Box, { id: 'nested' })),
      ])
    )
    const outer = (root.querySelector('#outer') as HTMLElement).className
    const nested = (root.querySelector('#nested') as HTMLElement).className
    expect(nested).not.toBe(outer)
    expect(rulesOf(outer)).toEqual([
      `.${outer}{color:var(--b-palette-primary);}`,
      `@media (width >= 900px){.${outer}{padding:var(--b-space-1);}}`,
    ])
    expect(rulesOf(nested)).toEqual([
      `.${nested}{color:var(--b-palette-primary);}`,
      `@media (width >= 500px){.${nested}{padding:var(--b-space-1);}}`,
    ])
  })

  it('gives the same class under two providers that differ only in token values', () => {
    const { styled, ThemeProvider } = setup()
    const Box = styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
    const root = mount(() =>
      h(ThemeProvider, { theme }, () => [
        h(Box, { id: 'outer' }),
        h(ThemeProvider, { theme: { palette: { primary: '#ff0000' } } }, () =>
          h(Box, { id: 'nested' })
        ),
      ])
    )
    expect((root.querySelector('#nested') as HTMLElement).className).toBe(
      (root.querySelector('#outer') as HTMLElement).className
    )
  })

  it('reads the theme of useStyle sheets in setup, from the nearest provider', () => {
    const { StyleSheet, useStyle, ThemeProvider, rulesOf } = setup()
    const sheet = StyleSheet.create((view) => ({
      box: { [`@media (width >= ${view.breakpoints[0]})`]: { margin: 1 } },
    }))
    const seen: string[] = []
    const Probe = defineComponent({
      setup() {
        seen.push(useStyle(sheet).box.className)
        return () => null
      },
    })
    mount(() =>
      h(ThemeProvider, { theme }, () => [
        h(Probe),
        h(ThemeProvider, { theme: { breakpoints: ['500px'] } }, () => h(Probe)),
      ])
    )
    expect(seen[0]).not.toBe(seen[1])
    expect(rulesOf(seen[1])[0]).toContain('@media (width >= 500px)')
  })
})
