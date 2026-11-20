import { at, createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'
import { playScopes } from './vitest.providerScope'
import type { CacheFunction } from './serverContext'

const base = { palette: { primary: '#0000ff', surface: '#ffffff' } }
const dark = { palette: { primary: '#8888ff', surface: '#111111' } }

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const engine = createEngine(base, {
    prefix: 's',
    cache: createCache({ prefix: 's', sheet: createMemorySheet() }),
  })
  return bindEngine(engine, requestCache)
}

describe('theme conditions in the server build', () => {
  it('sends the scoped rules in the element of the component class', async () => {
    const { styled, when, whenScheme, engine } = setup()
    const Card = styled('div')({
      border: 'none',
      ...at(when(dark), { border: '1px solid white' }),
      ...at(whenScheme('light'), { opacity: 0.5 }),
    })
    const tree = playScopes(await resolveTree(<Card>x</Card>))
    const [card] = findAll(tree, 'div')
    const name = card.props.className as string
    const [element] = findAll(tree, 'style')
    expect(element.props.href).toBe(name)
    const css = element.children.join('')
    expect(css).toContain(
      `@layer s-components{@scope (.${engine.themeId(dark)}) to (.s-boundary){.${name}{border:1px solid white;}}}`
    )
    expect(css).toContain('@scope (.s-scheme-light) to (.s-scheme-light,.s-scheme-dark)')
    expect(css).toContain('@media (prefers-color-scheme: light)')
  })

  it('keys the theme element by the theme class, and puts every class on the wrapper', async () => {
    const { ThemeProvider, engine } = setup()
    const tree = playScopes(
      await resolveTree(
        <ThemeProvider theme={base}>
          <ThemeProvider theme={dark} colorScheme="dark">
            x
          </ThemeProvider>
        </ThemeProvider>
      )
    )
    const [wrapper] = findAll(tree, 'div')
    expect(wrapper.props.className).toBe(`${engine.themeClass(dark, 'dark')} s-scope`)
    const hrefs = findAll(tree, 'style').map((element) => element.props.href)
    // The outermost provider sends its root theme; the nested one its theme class and the scope.
    expect(hrefs).toEqual([engine.declareRoot(base), engine.themeId(dark, 'dark'), 's-scope'])
  })
})
