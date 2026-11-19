import { createApp, h } from 'vue'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' }, zIndex: { modal: 100 } }

describe('an inline token in Vue', () => {
  it('follows the nearest provider', () => {
    const sheet = createMemorySheet()
    const { styled, ThemeProvider } = createStyle(theme, {
      prefix: 'i',
      modes: { zIndex: 'inline' },
      cache: createCache({ hasLayers: false, prefix: 'i', sheet }),
    })
    const Box = styled('div')(({ theme: view }) => ({
      color: view.palette.primary,
      zIndex: view.zIndex.modal,
    }))
    const root = document.createElement('div')
    createApp(() =>
      h(ThemeProvider, { theme }, () => [
        h(Box, { id: 'outer' }),
        h(ThemeProvider, { theme: { zIndex: { modal: 300 } } }, () => h(Box, { id: 'nested' })),
      ])
    ).mount(root)
    const outer = (root.querySelector('#outer') as HTMLElement).className
    const nested = (root.querySelector('#nested') as HTMLElement).className
    expect(nested).not.toBe(outer)
    expect(sheet.rules).toContain(`.${outer}{color:var(--i-palette-primary);z-index:100;}`)
    expect(sheet.rules).toContain(`.${nested}{color:var(--i-palette-primary);z-index:300;}`)
  })
})
