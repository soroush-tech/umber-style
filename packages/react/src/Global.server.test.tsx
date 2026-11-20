import { createCache, createEngine, createLazyEngine } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { palette: { text: '#111111' }, breakpoints: { md: 768 } }

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const engine = createEngine(theme, { prefix: 'r', cache: createCache({ prefix: 'r' }) })
  return bindEngine(engine, requestCache)
}

/** The href and the text of each style element of `tree`. */
const readStyles = (tree: Awaited<ReturnType<typeof resolveTree>>) =>
  findAll(tree, 'style').map((element) => [element.props.href, element.children.join('')])

describe('Global in the server components build', () => {
  it('renders the style elements of each set and of its animations, with the root theme of the request', async () => {
    const { Global, ThemeProvider, keyframes, globalStyles, engine } = setup()
    const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const base = globalStyles((view) => ({
      [`@media (min-width: ${view.breakpoints.md}px)`]: {
        body: { color: view.palette.text, animation: `${fade} 1s` },
      },
    }))
    const tree = await resolveTree(
      <ThemeProvider theme={{ breakpoints: { md: 1024 } }} isRoot>
        <Global styles={[base, { html: { margin: 0 } }]} />
      </ThemeProvider>
    )
    const [set, other] = engine.resolveGlobal(
      [base, { html: { margin: 0 } }],
      engine.createThemeView({ ...theme, breakpoints: { md: 1024 } })
    )
    const order = engine.cache.layerOrder
    expect(readStyles(tree)).toEqual([
      [fade, `@keyframes ${fade}{0%{opacity:0;}}`],
      [
        set.id,
        `${order}@layer r-global{@media (min-width: 1024px){body{color:var(--r-palette-text);animation:${fade} 1s;}}}`,
      ],
      [other.id, `${order}@layer r-global{html{margin:0;}}`],
    ])
    expect(findAll(tree, 'style').map((element) => element.props.precedence)).toEqual([
      'r',
      'r',
      'r',
    ])
    // A server unmounts nothing: the rules stay in the cache.
    expect(engine.cache.extract().ids).toEqual(expect.arrayContaining([set.id, other.id]))
  })

  it('renders the animation of a styled component in an element of its own, once for two classes', async () => {
    const { styled, keyframes } = setup()
    const pulse = keyframes({ '50%': { opacity: 0.4 } }, { label: 'pulse' })
    const Skeleton = styled('div', { name: 'Skeleton' })({
      animation: `${pulse} 1.5s ease-in-out infinite`,
    })
    const Bar = styled('i', { name: 'Bar' })({ animationName: pulse })
    const tree = await resolveTree(
      <>
        <Skeleton />
        <Bar />
      </>
    )
    const hrefs = findAll(tree, 'style').map((element) => element.props.href)
    expect(hrefs.filter((href) => href === pulse)).toHaveLength(2)
    expect(readStyles(tree)[0]).toEqual([pulse, `@keyframes ${pulse}{50%{opacity:0.4;}}`])
  })

  it('writes an object with no theme at all, and calls a function of the theme with an empty one', async () => {
    const style = bindEngine(createLazyEngine({ prefix: 'z' }), requestCache)
    const tree = await resolveTree(<style.Global styles={{ body: { margin: 0 } }} />)
    expect(readStyles(tree)).toEqual([
      [
        expect.stringMatching(/^z-global-/),
        `${style.cache.layerOrder}@layer z-global{body{margin:0;}}`,
      ],
    ])
    const seen: unknown[] = []
    await resolveTree(<style.Global styles={(view) => (seen.push(view), { body: {} })} />)
    expect(seen).toEqual([{}])
  })
})
