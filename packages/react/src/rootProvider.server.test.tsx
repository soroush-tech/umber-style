import { createCache, createEngine, createLazyEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { palette: { primary: '#0000ff' } }

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

describe('a server ThemeProvider with isRoot', () => {
  it('renders no element, still sends the style of the theme class, and gives the root theme', async () => {
    const sheet = createMemorySheet()
    const engine = createEngine(theme, {
      prefix: 'r',
      cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'r', sheet }),
    })
    const { ThemeProvider, readTheme, themeClass } = bindEngine(engine, requestCache)
    // The app makes the rule of the class it puts on <html>; a root provider only sends it.
    themeClass(theme)
    const tree = await resolveTree(
      <ThemeProvider theme={theme} isRoot>
        <i />
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <b />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(findAll(tree, 'div')).toHaveLength(1)
    expect(findAll(tree, 'i')).toHaveLength(1)
    const styles = findAll(tree, 'style')
    expect(styles).toHaveLength(3)
    expect(styles[0].children).toEqual([
      sheet.rules.find((rule) => rule.includes('#0000ff')) as string,
    ])
    expect(readTheme()).toBe(theme)
  })
})

describe('a server ThemeProvider with isRoot and a color scheme of its own', () => {
  function setupRoot() {
    const sheet = createMemorySheet()
    const engine = createLazyEngine<typeof theme>({
      prefix: 'r',
      cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'r', sheet }),
    })
    return { ...bindEngine(engine, requestCache), engine, sheet }
  }

  it('sends the style of the classes the app made for this theme, and makes none', async () => {
    const { ThemeProvider, themeClass, sheet, engine } = setupRoot()
    themeClass(theme, 'light')
    const before = [...sheet.rules]
    const tree = await resolveTree(
      <ThemeProvider theme={theme} colorScheme="dark" isRoot>
        <i />
      </ThemeProvider>
    )
    expect(sheet.rules).toEqual(before)
    expect(findAll(tree, 'div')).toHaveLength(0)
    const styles = findAll(tree, 'style')
    expect(styles.map((style) => style.children)).toEqual([[before[0]]])
    expect(engine.hasTheme).toBe(true)
  })

  it('sends one style for each scheme the app asked for, and none when it asked for none', async () => {
    const { ThemeProvider, themeClass, sheet } = setupRoot()
    const none = await resolveTree(
      <ThemeProvider theme={theme} isRoot>
        <i />
      </ThemeProvider>
    )
    expect(findAll(none, 'style')).toHaveLength(0)
    expect(sheet.rules).toEqual([])
    themeClass(theme, 'light')
    themeClass(theme)
    const some = await resolveTree(
      <ThemeProvider theme={theme} isRoot>
        <i />
      </ThemeProvider>
    )
    expect(findAll(some, 'style')).toHaveLength(2)
  })
})
