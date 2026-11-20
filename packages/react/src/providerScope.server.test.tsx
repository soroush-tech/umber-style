import { createEngine } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { ProviderScopeProps, ScopeTheme } from './ProviderScope'
import type { CacheFunction } from './serverContext'
import { findAll, resolveTree, type ResolvedElement, type ResolvedNode } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff', text: '#111111' }, breakpoints: ['600px'] }
const brand = { palette: { primary: '#ff0000' }, breakpoints: ['300px'] }

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

/** One engine; each call of the result is a request of its own. */
function setup() {
  const engine = createEngine(theme, { prefix: 'sp' })
  return { engine, request: () => bindEngine(engine, requestCache) }
}

/** The elements of the reference to `ProviderScope`, in document order. */
function findScopes(nodes: readonly ResolvedNode[]): ResolvedElement[] {
  return nodes.flatMap((node) =>
    typeof node === 'string'
      ? []
      : [
          ...((node.type as unknown as { $$id?: string }).$$id === 'ProviderScope' ? [node] : []),
          ...findScopes(node.children),
        ]
  )
}

const propsOf = (node: ResolvedElement) => node.props as unknown as ProviderScopeProps

describe('a provider of the server build does not decide whether it is nested', () => {
  it('renders the same data for the first provider of a request (a partial render) as for a nested one', async () => {
    const { request } = setup()
    const full = await resolveTree(
      (() => {
        const { ThemeProvider } = request()
        return (
          <ThemeProvider theme={theme}>
            <ThemeProvider theme={brand}>
              <b />
            </ThemeProvider>
          </ThemeProvider>
        )
      })()
    )
    const { ThemeProvider } = request()
    const partial = await resolveTree(
      <ThemeProvider theme={brand}>
        <b />
      </ThemeProvider>
    )
    const nested = propsOf(findScopes(full)[1]).theme
    const first = propsOf(findScopes(partial)[0]).theme
    // The base theme comes with the first provider of a request only.
    const { base, rootId, ...shared } = first as ScopeTheme
    expect(nested).toMatchObject(shared)
    expect([base, rootId]).not.toEqual([nested?.base, nested?.rootId])
    // The server renders no wrapper and no theme rule itself: the browser part does.
    expect(findAll(partial, 'div')).toEqual([])
    expect(findAll(partial, 'style')).toEqual([])
    expect(first).toMatchObject({
      as: 'div',
      className: expect.stringMatching(/^sp-theme-\w+ sp-boundary sp-scope$/),
      classId: expect.stringMatching(/^sp-theme-\w+$/),
      rootId: expect.stringMatching(/^sp-root-\w+$/),
      layerOrder: '@layer sp-theme,sp-global,sp-components,sp-overrides;',
      own: { declarations: '--sp-palette-primary:#ff0000;', properties: '' },
      isWhole: false,
      base: {
        declarations: '--sp-palette-primary:#0000ff;--sp-palette-text:#111111;',
        properties: '',
      },
    })
    expect(nested?.base).toBeUndefined()
    expect(nested?.styles.map(({ href }) => href)).toEqual(['sp-scope'])
  })

  it('sends the base theme as one object, from the first provider of a request, and none for a theme that declares all of it', async () => {
    const { request } = setup()
    const render = async (outer: object) => {
      const { ThemeProvider } = request()
      return findScopes(
        await resolveTree(
          <ThemeProvider theme={outer} colorScheme="light">
            <ThemeProvider theme={brand}>
              <b />
            </ThemeProvider>
            <ThemeProvider theme={{ palette: { text: '#000000' } }} className="mine">
              <i />
            </ThemeProvider>
          </ThemeProvider>
        )
      ).map((node) => propsOf(node).theme)
    }
    const [outer, first, second] = await render(theme)
    expect(outer?.isWhole).toBe(true)
    expect(outer?.base).toBeUndefined()
    expect(outer?.own.declarations).toBe(
      '--sp-palette-primary:#0000ff;--sp-palette-text:#111111;color-scheme:light;'
    )
    expect([first?.base, second?.base]).toEqual([undefined, undefined])
    expect(second?.className).toMatch(/ sp-scope mine$/)
    // Each request of one style names the same object.
    let current = 0
    const perRequest: CacheFunction = (make) => {
      let value: ReturnType<typeof make> | undefined
      let at = -1
      return () => {
        if (at !== current) value = make()
        at = current
        return value as ReturnType<typeof make>
      }
    }
    const { ThemeProvider } = bindEngine(createEngine(theme, { prefix: 'sp' }), perRequest)
    const bases = []
    // Two partial themes, each the first provider of its request, and the first again.
    for (const given of [brand, { palette: { text: '#000000' } }, brand]) {
      current += 1
      const [scope] = findScopes(await resolveTree(<ThemeProvider theme={given} />))
      bases.push(propsOf(scope).theme?.base)
    }
    expect(bases[0]).toBeDefined()
    expect(bases[1]).toBe(bases[0])
    expect(bases[2]).toBe(bases[0])
  })

  it('renders the browser part with no theme for isRoot, after the style of the classes the app made', async () => {
    const { request } = setup()
    const { ThemeProvider, themeClass } = request()
    themeClass(theme)
    const tree = await resolveTree(
      <ThemeProvider theme={theme} isRoot>
        <b />
      </ThemeProvider>
    )
    const [scope] = findScopes(tree)
    expect(propsOf(scope)).toEqual({ prefix: 'sp' })
    expect(findAll(tree, 'style')).toHaveLength(1)
    expect(findAll(tree, 'b')).toHaveLength(1)
  })

  it('gives readTheme the theme of the first provider of the request: in a partial render, the page provider over the base theme', async () => {
    const { request } = setup()
    const { ThemeProvider, readTheme } = request()
    const seen: string[] = []
    const Probe = () => {
      seen.push(readTheme().breakpoints[0])
      return null
    }
    await resolveTree(
      <ThemeProvider theme={brand}>
        <Probe />
      </ThemeProvider>
    )
    expect(seen).toEqual(['300px'])
    expect(readTheme().palette.text).toBe('#111111')
  })

  it('renders styled components with no provider anywhere', async () => {
    const { request } = setup()
    const { styled } = request()
    const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({ color: view.palette.text }))
    const tree = await resolveTree(<Box />)
    expect(findAll(tree, 'div')[0].props.className).toMatch(/^sp-box-root-\w+$/)
    expect(findScopes(tree)).toEqual([])
  })
})

describe('a provider of the server build after the base theme changed', () => {
  it('sends the new base theme for the same theme object', async () => {
    const engine = createEngine(theme, { prefix: 'sb' })
    let current = 0
    const perRequest: CacheFunction = (make) => {
      let value: ReturnType<typeof make> | undefined
      let at = -1
      return () => {
        if (at !== current) value = make()
        at = current
        return value as ReturnType<typeof make>
      }
    }
    const { ThemeProvider } = bindEngine(engine, perRequest)
    const render = async () => {
      current += 1
      const [scope] = findScopes(await resolveTree(<ThemeProvider theme={brand} />))
      return propsOf(scope).theme?.base?.declarations
    }
    expect(await render()).toBe('--sb-palette-primary:#0000ff;--sb-palette-text:#111111;')
    engine.setTheme({ palette: { primary: '#00ff00', text: '#222222' }, breakpoints: ['1px'] })
    expect(await render()).toBe('--sb-palette-primary:#00ff00;--sb-palette-text:#222222;')
  })
})
