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

describe('what a pruned server render leaves for the client', () => {
  const two = { palette: { primary: '#0000ff', accent: '#ff0000' } }

  it('has the client add only the variable that the server did not use, once', () => {
    const server = bindEngine(
      createEngine(two, {
        prefix: 'p',
        cache: createCache({ prefix: 'p', sheet: createMemorySheet() }),
      })
    )
    const Box = server.styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
    render(
      <server.ThemeProvider theme={two}>
        <Box />
      </server.ThemeProvider>
    ).container.remove()
    document.head.innerHTML = createStyleTag(server.cache)
    const element = document.querySelector('style[data-style="p"]') as HTMLStyleElement
    const declaring = (variable: string) =>
      [...(element.sheet?.cssRules ?? [])].filter((rule) => rule.cssText.includes(`${variable}:`))

    expect(declaring('--p-palette-primary')).toHaveLength(1)
    expect(declaring('--p-palette-accent')).toHaveLength(0)
    const client = bindEngine(createEngine(two, { prefix: 'p' }))
    const Same = client.styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
    const Other = client.styled('div')(({ theme: view }) => ({ color: view.palette.accent }))
    render(
      <client.ThemeProvider theme={two}>
        <Same />
        <Other />
      </client.ThemeProvider>
    )
    expect(declaring('--p-palette-primary')).toHaveLength(1)
    expect(declaring('--p-palette-accent')).toHaveLength(1)
  })
})
