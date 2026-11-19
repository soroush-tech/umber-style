import { render } from '@testing-library/react'
import { createCache, createEngine, createMemorySheet, createStyleTag } from '@umber-style/core'
import { bindEngine } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

afterEach(() => {
  document.head.innerHTML = ''
})

describe('what a classic server render leaves for the client', () => {
  it('is a style element with the ids, and the client cache inserts none of them again', () => {
    const server = bindEngine(
      createEngine(theme, {
        prefix: 'h',
        cache: createCache({ prefix: 'h', sheet: createMemorySheet() }),
      })
    )
    const Box = server.styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
    const { container } = render(
      <server.ThemeProvider theme={theme}>
        <Box />
      </server.ThemeProvider>
    )
    const tag = createStyleTag(server.cache)
    expect(tag).toContain('data-ids="')
    container.remove()

    document.head.innerHTML = tag
    const element = document.querySelector('style[data-style="h"]') as HTMLStyleElement
    const before = element.sheet?.cssRules.length
    expect(before).toBeGreaterThan(1)
    const client = bindEngine(createEngine(theme, { prefix: 'h' }))
    const Again = client.styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
    render(
      <client.ThemeProvider theme={theme}>
        <Again />
      </client.ThemeProvider>
    )
    expect(element.sheet?.cssRules.length).toBe(before)
    expect(document.querySelectorAll('style[data-style="h"]')).toHaveLength(1)
  })
})
