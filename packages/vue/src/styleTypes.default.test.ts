// The default style types through the Vue binding: `pnpm typecheck` compiles this file without the
// strict switch (tsconfig.json); styleTypes.strict.test.ts and tsconfig.strict.json are the strict ones.
import { createApp, h } from 'vue'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { space: [0, 4, 8], breakpoints: ['40em'] }

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, { prefix: 'v', cache: createCache({ prefix: 'v', sheet }) })
  return { ...style, sheet }
}

describe('the default style types through the Vue binding', () => {
  it('take values widened to string and keys computed from the theme', () => {
    const { styled, css, StyleSheet, sheet } = setup()
    const card = { display: 'grid', alignItems: 'start' }
    const Box = styled('div')(card, ({ theme: view }) => ({
      [`@media (min-width: ${view.breakpoints[0]})`]: { gap: view.space[1] },
    }))
    const entry = css(card)
    const entries = StyleSheet.create({ card })
    const element = document.createElement('div')
    createApp(() => h(Box)).mount(element)
    expect(String(entry)).toBe(entries.card.className)
    expect(sheet.rules.join('')).toContain('display:grid;align-items:start;')
    expect(sheet.rules.join('')).toContain('@media (min-width: 40em){')
  })
})
