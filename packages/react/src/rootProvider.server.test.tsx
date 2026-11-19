import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree } from './resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { palette: { primary: '#0000ff' } }

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

describe('a server ThemeProvider with isRoot', () => {
  it('renders no element, still sends the style of the theme class, and gives the root theme', async () => {
    const sheet = createMemorySheet()
    const engine = createEngine(theme, { prefix: 'r', cache: createCache({ prefix: 'r', sheet }) })
    const { ThemeProvider, readTheme } = bindEngine(engine, requestCache)
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
