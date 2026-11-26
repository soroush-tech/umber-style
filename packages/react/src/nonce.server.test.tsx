import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { playScopes } from './vitest.providerScope'
import { findAll, resolveTree, type ResolvedElement, type ResolvedNode } from './vitest.resolveTree'

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

/** Every element of `nodes` (and below) that is the reference to `NonceStyles`, in document order. */
function findNonceStyles(nodes: readonly ResolvedNode[]): ResolvedElement[] {
  return nodes.flatMap((node) => {
    if (typeof node === 'string') return []
    const isNonceStyles = (node.type as unknown as { $$id?: string }).$$id === 'NonceStyles'
    return [...(isNonceStyles ? [node] : []), ...findNonceStyles(node.children)]
  })
}

describe('the style elements of the server components build', () => {
  it('carry the fixed nonce of the cache, with no source: a styled class, its animation, global rules and the providers, all in place', async () => {
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
    expect(findAll(tree, 'style'), 'hoisted elements').toEqual([])
    // The providers, `Global` and the box: one `NonceStyles` each.
    const styles = findNonceStyles(tree)
    expect(styles.length).toBeGreaterThanOrEqual(4)
    expect(styles.map((element) => element.props.nonce)).toEqual(styles.map(() => 'n0nce'))
    expect(JSON.stringify(styles.map((element) => element.props.texts))).not.toContain('n0nce')
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
