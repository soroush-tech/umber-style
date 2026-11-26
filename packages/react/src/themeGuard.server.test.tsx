import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { resolveTree } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff', text: '#111111' } }
type PageTheme = typeof theme

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup(prefix: string, hasDevChecks: boolean) {
  const engine = createEngine(theme, {
    prefix,
    hasDevChecks,
    cache: createCache({ prefix, sheet: createMemorySheet() }),
  })
  return bindEngine(engine, requestCache)
}

describe('the base theme that a provider function of the server build gets', () => {
  it('in development, throws on a write, naming the path: it is the same object for every request', async () => {
    const { ThemeProvider } = setup('tg', true)
    await expect(
      resolveTree(
        <ThemeProvider
          theme={(outer: PageTheme) => {
            outer.palette.primary = '#ff0000'
            return {}
          }}
        >
          <i />
        </ThemeProvider>
      )
    ).rejects.toThrow('[tg] theme.palette.primary is set by a function of "ThemeProvider".')
    expect(theme.palette.primary).toBe('#0000ff')
  })

  it('in production, is the base theme itself', async () => {
    const { ThemeProvider } = setup('th', false)
    let given: unknown
    await resolveTree(
      <ThemeProvider
        theme={(outer: PageTheme) => {
          given = outer
          return {}
        }}
      >
        <i />
      </ThemeProvider>
    )
    expect(given).toBe(theme)
  })
})
