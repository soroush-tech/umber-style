import { createEngine, createLazyEngine } from '@umber-style/core'
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

/** A cache function whose slot is new each time `current` changes: one style, one request at a time. */
function createRequests() {
  const state = { current: 0 }
  const cache: CacheFunction = (make) => {
    let value: ReturnType<typeof make> | undefined
    let at = -1
    return () => {
      if (at !== state.current) value = make()
      at = state.current
      return value as ReturnType<typeof make>
    }
  }
  return { state, cache }
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

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
    const nested = propsOf(findScopes(full)[1])
    const first = propsOf(findScopes(partial)[0])
    // The base theme comes with the first provider of a request only.
    const { base, rootId, ...shared } = first.theme as ScopeTheme
    expect(nested.theme).toMatchObject(shared)
    expect(nested.given).toBe(first.given)
    expect([base, rootId]).not.toEqual([nested.theme?.base, nested.theme?.rootId])
    // The server renders no wrapper and no theme rule itself: the browser part does.
    expect(findAll(partial, 'div')).toEqual([])
    expect(findAll(partial, 'style')).toEqual([])
    // The values are sent once, as the theme given: the rules are made from them in the browser.
    expect(first.given).toBe(brand)
    expect(first.theme).toEqual({
      as: 'div',
      className: expect.stringMatching(/^sp-theme-\w+ sp-boundary sp-scope$/),
      classId: expect.stringMatching(/^sp-theme-\w+$/),
      rootId: expect.stringMatching(/^sp-root-\w+$/),
      layerOrder: '@layer sp-theme,sp-global,sp-components,sp-overrides;',
      tokens: {},
      properties: '',
      isWhole: false,
      base: { theme, properties: '' },
      styles: [expect.objectContaining({ href: 'sp-scope' })],
    })
    expect(nested.theme?.base).toBeUndefined()
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
    expect(outer?.colorScheme).toBe('light')
    expect([first?.base, second?.base]).toEqual([undefined, undefined])
    expect(second?.className).toMatch(/ sp-scope mine$/)
    // Each request of one style names the same object.
    const { state, cache } = createRequests()
    const { ThemeProvider } = bindEngine(createEngine(theme, { prefix: 'sp' }), cache)
    const bases = []
    // Two partial themes, each the first provider of its request, and the first again.
    for (const given of [brand, { palette: { text: '#000000' } }, brand]) {
      state.current += 1
      const [scope] = findScopes(await resolveTree(<ThemeProvider theme={given} />))
      bases.push(propsOf(scope).theme?.base)
    }
    expect(bases[0]).toBeDefined()
    expect(bases[1]).toBe(bases[0])
    expect(bases[2]).toBe(bases[0])
  })

  it('sends the token options of the engine as plain data, one object for the engine', async () => {
    const engine = createEngine(theme, {
      prefix: 'so',
      rawKeys: ['breakpoints'],
      lengthKeys: ['space'],
      modes: { 'palette.text': 'inline' },
    })
    const { ThemeProvider } = bindEngine(engine, requestCache)
    const scopes = findScopes(
      await resolveTree(
        <ThemeProvider theme={theme}>
          <ThemeProvider theme={brand} />
        </ThemeProvider>
      )
    )
    const [outer, inner] = scopes.map((node) => propsOf(node).theme?.tokens)
    expect(outer).toEqual({
      rawKeys: ['breakpoints'],
      lengthKeys: ['space'],
      modes: { 'palette.text': 'inline' },
    })
    expect(inner).toBe(outer)
  })

  it('renders the browser part with no rules for isRoot, with its theme, after the style of the classes the app made', async () => {
    const { request } = setup()
    const { ThemeProvider, themeClass } = request()
    themeClass(theme)
    const tree = await resolveTree(
      <ThemeProvider theme={theme} isRoot>
        <b />
      </ThemeProvider>
    )
    const [scope] = findScopes(tree)
    expect(propsOf(scope)).toEqual({ prefix: 'sp', given: theme })
    expect(findAll(tree, 'style')).toHaveLength(1)
    expect(findAll(tree, 'b')).toHaveLength(1)
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

describe('useTheme in the server build: the base theme', () => {
  /** What a server component reads, in a full render of the layout and the page, and in a partial render of the page alone. */
  async function readBoth() {
    const engine = createEngine(theme, { prefix: 'su' })
    const seen: Record<string, string[]> = { full: [], partial: [] }
    const Probe = ({ style, name }: { style: { useTheme(): typeof theme }; name: string }) => {
      seen[name].push(style.useTheme().breakpoints[0])
      return null
    }
    const layout = bindEngine(engine, requestCache)
    await resolveTree(
      <layout.ThemeProvider theme={brand}>
        <Probe style={layout} name="full" />
        <layout.ThemeProvider theme={{ breakpoints: ['100px'] }}>
          <Probe style={layout} name="full" />
        </layout.ThemeProvider>
      </layout.ThemeProvider>
    )
    const page = bindEngine(engine, requestCache)
    await resolveTree(
      <page.ThemeProvider theme={{ breakpoints: ['100px'] }}>
        <Probe style={page} name="partial" />
      </page.ThemeProvider>
    )
    return seen
  }

  it('is the same in a full and in a partial render, whatever providers render', async () => {
    expect(await readBoth()).toEqual({ full: ['600px', '600px'], partial: ['600px'] })
  })

  it('is an empty object with no base theme, with one warning in development that names createStyle and configure', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const engine = createLazyEngine<typeof theme>({ prefix: 'sn' })
    const style = bindEngine(engine, requestCache)
    const seen: object[] = []
    const Probe = () => {
      seen.push(style.useTheme())
      return null
    }
    await resolveTree(
      <style.ThemeProvider theme={theme}>
        <Probe />
        <Probe />
      </style.ThemeProvider>
    )
    expect(seen).toEqual([{}, {}])
    expect(engine.hasTheme).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(
      /^\[sn\] useTheme\(\) in a server component .*createStyle\(theme\) or configure\(\{ theme \}\)/
    )
  })

  it('warns about no base theme only in development', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(bindEngine(createLazyEngine({ prefix: 'sx' }), requestCache).useTheme()).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  it('calls a function theme with the base theme, in a full and in a partial render', async () => {
    const engine = createEngine(theme, { prefix: 'sf' })
    const seen: string[] = []
    const surface = (outer: typeof theme) => {
      seen.push(outer.palette.text)
      return { palette: { primary: outer.palette.text } }
    }
    const layout = bindEngine(engine, requestCache)
    await resolveTree(
      <layout.ThemeProvider theme={{ palette: { text: '#222222' } }}>
        <layout.ThemeProvider theme={surface} />
      </layout.ThemeProvider>
    )
    const page = bindEngine(engine, requestCache)
    const [scope] = findScopes(await resolveTree(<page.ThemeProvider theme={surface} />))
    expect(seen).toEqual(['#111111', '#111111'])
    // What is sent is the theme the function returned.
    expect(propsOf(scope).given).toEqual({ palette: { primary: '#111111' } })
  })
})

describe('what crosses to the browser part', () => {
  class Color {
    constructor(readonly value: string) {}
  }
  const up = (width: string) => `@media (min-width: ${width})`
  const rich = {
    palette: { primary: '#ff0000', mix: () => 'red', shade: new Color('#000') },
    breakpoints: ['300px', up],
    components: { Button: { styleOverrides: () => ({}) } },
    marker: Symbol('marker'),
  }

  it('leaves out functions, symbols and class instances, deeply, and warns once in development with their paths', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ThemeProvider } = bindEngine(createEngine(theme, { prefix: 'sd' }), requestCache)
    const tree = await resolveTree(
      <ThemeProvider theme={rich as never}>
        <ThemeProvider theme={{ palette: { mix: () => 'blue' } } as never} />
      </ThemeProvider>
    )
    const [outer, inner] = findScopes(tree).map((node) => propsOf(node).given)
    expect(outer).toEqual({
      palette: { primary: '#ff0000' },
      breakpoints: ['300px', undefined],
      components: { Button: {} },
    })
    expect(inner).toEqual({ palette: {} })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain(
      '[sd] A ThemeProvider of a server component was given a theme with members that cannot cross to a client component: palette.mix, palette.shade, breakpoints.1, components.Button.styleOverrides, marker.'
    )
  })

  it('sends a theme of plain data as it is, copies an object with no prototype, and warns nothing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ThemeProvider } = bindEngine(createEngine(theme, { prefix: 'sq' }), requestCache)
    const bare = Object.assign(Object.create(null) as object, { palette: { primary: '#00ff00' } })
    const tree = await resolveTree(
      <ThemeProvider theme={theme}>
        <ThemeProvider theme={bare} />
        <ThemeProvider theme={rich as never} />
      </ThemeProvider>
    )
    const [whole, copied] = findScopes(tree).map((node) => propsOf(node).given)
    expect(whole).toBe(theme)
    expect(copied).not.toBe(bare)
    expect(Object.getPrototypeOf(copied)).toBe(Object.prototype)
    expect(copied).toEqual({ palette: { primary: '#00ff00' } })
    expect(warn).not.toHaveBeenCalled()
  })

  /** Whether `value` is plain data at every depth: no prototype but the usual one, no member that is not enumerable, no symbol key. */
  const isPlainDeep = (value: unknown): boolean => {
    if (typeof value !== 'object' || value === null) return typeof value !== 'function'
    const isList = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    const visible = Object.keys(value).length + (isList ? 1 : 0)
    return (
      (isList || prototype === Object.prototype) &&
      Reflect.ownKeys(value).length === visible &&
      Object.values(value).every(isPlainDeep)
    )
  }

  it('sends a theme with hidden members (not enumerable, or under a symbol) as a plain copy, the given theme and the base theme, with no warning in development (#81)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const sizes = { sm: '600px', md: '840px' }
    const breakpoints = { ...sizes }
    Object.defineProperty(breakpoints, 'up', {
      value: (key: keyof typeof sizes) => `@media (min-width:${sizes[key]})`,
      enumerable: false,
    })
    Object.defineProperty(breakpoints, 'down', { value: () => '', enumerable: false })
    const helpers = {
      palette: { primary: '#0000ff', text: '#111111', [Symbol('brand')]: true },
      breakpoints,
    }
    const modes = { 'palette.primary': 'reference' as const }
    Object.defineProperty(modes, 'note', { value: 'hidden', enumerable: false })
    const engine = createEngine(helpers, { prefix: 'sh', modes })
    const { ThemeProvider } = bindEngine(engine, requestCache)
    const tree = await resolveTree(
      <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
        <ThemeProvider theme={helpers} />
      </ThemeProvider>
    )
    const [outer, inner] = findScopes(tree).map(propsOf)
    const base = (outer.theme as ScopeTheme).base?.theme
    expect(base).toEqual({
      palette: { primary: '#0000ff', text: '#111111' },
      breakpoints: { sm: '600px', md: '840px' },
    })
    expect(isPlainDeep(base)).toBe(true)
    expect(inner.given).not.toBe(helpers)
    expect(inner.given).toEqual(base)
    expect(isPlainDeep(inner.given)).toBe(true)
    // The token options cross too: an option object with a hidden member is copied the same way.
    expect((inner.theme as ScopeTheme).tokens).toEqual({
      modes: { 'palette.primary': 'reference' },
    })
    expect(isPlainDeep((inner.theme as ScopeTheme).tokens)).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('sends the base theme as it is when it has no hidden member', async () => {
    const { ThemeProvider } = bindEngine(createEngine(theme, { prefix: 'sn' }), requestCache)
    const [scope] = findScopes(
      await resolveTree(<ThemeProvider theme={{ palette: { primary: '#ff0000' } }} />)
    )
    expect((propsOf(scope).theme as ScopeTheme).base?.theme).toBe(theme)
  })

  it('sends an empty theme for a theme that is itself not plain data', async () => {
    const { ThemeProvider } = bindEngine(createEngine(theme, { prefix: 'sc' }), requestCache)
    const [scope] = findScopes(
      await resolveTree(<ThemeProvider theme={new Color('#fff') as never} />)
    )
    expect(propsOf(scope).given).toEqual({})
  })
})

describe('a provider of the server build after the base theme changed', () => {
  it('sends the new base theme for the same theme object', async () => {
    const engine = createEngine(theme, { prefix: 'sb' })
    const { state, cache } = createRequests()
    const { ThemeProvider } = bindEngine(engine, cache)
    const render = async () => {
      state.current += 1
      const [scope] = findScopes(await resolveTree(<ThemeProvider theme={brand} />))
      return propsOf(scope).theme?.base?.theme
    }
    expect(await render()).toBe(theme)
    const next = { palette: { primary: '#00ff00', text: '#222222' }, breakpoints: ['1px'] }
    engine.setTheme(next)
    expect(await render()).toBe(next)
  })
})
