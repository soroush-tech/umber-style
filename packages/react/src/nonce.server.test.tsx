import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { playScopes } from './vitest.providerScope'
import { findAll, resolveTree } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff', text: '#111111' } }

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

/** The server build over an engine whose cache has `nonce`. */
function setup(nonce?: string) {
  const cache = createCache({ prefix: 'nc', sheet: createMemorySheet(), nonce })
  return bindEngine(createEngine(theme, { prefix: 'nc', cache }), requestCache)
}

describe('the style elements of the server components build', () => {
  it('carry the nonce of the cache: a styled class, its animation, global rules and the providers', async () => {
    const { styled, Global, ThemeProvider, keyframes, themeClass } = setup('n0nce')
    const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({
      color: view.palette.primary,
      animation: `${fade} 1s`,
    }))
    const root = themeClass({ palette: { text: '#222222' } })
    const tree = playScopes(
      await resolveTree(
        <>
          <ThemeProvider theme={{ palette: { text: '#222222' } }} isRoot>
            <i className={root} />
          </ThemeProvider>
          <ThemeProvider theme={{ palette: { text: '#333333' } }}>
            <Global styles={{ body: { margin: 0 } }} />
            <ThemeProvider theme={{ palette: { primary: '#444444' } }} className="nested">
              <Box />
            </ThemeProvider>
          </ThemeProvider>
        </>
      )
    )
    const styles = findAll(tree, 'style')
    // The theme class of isRoot, the root rule, the global set, the nested theme, the animation, the class.
    expect(styles.length).toBeGreaterThanOrEqual(6)
    expect(styles.map((element) => element.props.nonce)).toEqual(styles.map(() => 'n0nce'))
    expect(styles.map((element) => element.children.join('')).join('')).not.toContain('n0nce')
  })

  it('carry no nonce when the cache has none', async () => {
    const { styled, ThemeProvider } = setup()
    const Box = styled('div', { name: 'Box' })({ color: 'red' })
    const tree = playScopes(
      await resolveTree(
        <ThemeProvider theme={{ palette: { text: '#222222' } }}>
          <ThemeProvider theme={{ palette: { primary: '#444444' } }}>
            <Box />
          </ThemeProvider>
        </ThemeProvider>
      )
    )
    const styles = findAll(tree, 'style')
    expect(styles.length).toBeGreaterThan(0)
    expect(styles.map((element) => element.props.nonce)).toEqual(styles.map(() => undefined))
  })
})
