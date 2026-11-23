import { render } from '@testing-library/react'
import { createCache, createEngine, createMemorySheet, createStyleTag } from '@umber-style/core'
import { bindEngine } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

afterEach(() => {
  document.head.innerHTML = ''
})

/** The rules that the browser took from the style elements of `prefix`, in document order. */
const readPageRules = (prefix: string) =>
  [...document.querySelectorAll<HTMLStyleElement>(`style[data-style="${prefix}"]`)].flatMap(
    (element) => [...(element.sheet?.cssRules ?? [])]
  )

describe('what a classic server render leaves for the client', () => {
  // Written by text, the client cache writes in a style element of its own, next to the server's.
  it.each([
    { speedy: false, elements: 2 },
    { speedy: true, elements: 1 },
  ])(
    'is a style element with the options, and the client cache inserts none of its rules again, %o',
    ({ speedy, elements }) => {
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
      expect(tag).toContain(`data-options="${server.cache.fingerprint}"`)
      container.remove()

      document.head.innerHTML = tag
      const before = readPageRules('h').length
      expect(before).toBeGreaterThan(1)
      const client = bindEngine(createEngine(theme, { prefix: 'h', speedy }))
      const Again = client.styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
      render(
        <client.ThemeProvider theme={theme}>
          <Again />
        </client.ThemeProvider>
      )
      expect(readPageRules('h')).toHaveLength(before)
      expect(document.querySelectorAll('style[data-style="h"]')).toHaveLength(elements)
    }
  )
})

describe('what a pruned server render leaves for the client', () => {
  const two = { palette: { primary: '#0000ff', accent: '#ff0000' } }

  it.each([true, false])(
    'has the client add only the variable that the server did not use, once, speedy %s',
    (speedy) => {
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
      const declaring = (variable: string) =>
        readPageRules('p').filter((rule) => rule.cssText.includes(`${variable}:`))

      expect(declaring('--p-palette-primary')).toHaveLength(1)
      expect(declaring('--p-palette-accent')).toHaveLength(0)
      const client = bindEngine(createEngine(two, { prefix: 'p', speedy }))
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
    }
  )
})
