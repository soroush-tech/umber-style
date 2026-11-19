import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, zIndex: { modal: 100 } }

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const sheet = createMemorySheet()
  const engine = createEngine(theme, {
    prefix: 's',
    modes: { zIndex: 'inline' },
    cache: createCache({ hasLayers: false, prefix: 's', sheet }),
  })
  return { ...bindEngine(engine, requestCache), sheet }
}

describe('an inline token in the server build', () => {
  it('follows the root theme of the request', async () => {
    const { styled, ThemeProvider, sheet } = setup()
    const Box = styled('div')(({ theme: view }) => ({
      color: view.palette.primary,
      zIndex: view.zIndex.modal,
    }))
    const tree = await resolveTree(
      <ThemeProvider theme={{ ...theme, zIndex: { modal: 300 } }} isRoot>
        <Box />
      </ThemeProvider>
    )
    const [box] = findAll(tree, 'div')
    const className = box.props.className as string
    expect(sheet.rules).toContain(`.${className}{color:var(--s-palette-primary);z-index:300;}`)
  })

  it('sends the whole theme class in its style element, whatever the sheet holds', async () => {
    const { styled, ThemeProvider, themeClass, sheet } = setup()
    const Box = styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
    // The app makes the rule of the class it puts on <html>; a root provider only sends it.
    themeClass(theme)
    const tree = await resolveTree(
      <ThemeProvider theme={theme} isRoot>
        <Box />
      </ThemeProvider>
    )
    const [first] = findAll(tree, 'style')
    // Every variable of the theme, used or not: the provider cannot know what its children use.
    expect(first.children).toEqual([
      expect.stringMatching(
        /^\.s-theme-\w+\{--s-palette-primary:#0000ff;--s-palette-accent:#ff0000;\}$/
      ),
    ])
    expect(sheet.rules.find((rule) => rule.startsWith('.s-theme-'))).toMatch(
      /^\.s-theme-\w+\{--s-palette-primary:#0000ff;\}$/
    )
  })
})
