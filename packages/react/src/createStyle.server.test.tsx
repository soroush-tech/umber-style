import {
  at,
  createCache,
  createEngine,
  createLazyEngine,
  createMemorySheet,
} from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle.server'
import { findAll, resolveTree, type ResolvedElement } from './vitest.resolveTree'
import { playScopes } from './vitest.providerScope'
import type { CacheFunction } from './serverContext'

const theme = {
  palette: { primary: '#0000ff' },
  space: [0, 4, 8],
  breakpoints: ['900px'],
}

/** The class of the Box below under the outer theme: the client build must make the same one. */
const BOX_CLASS = 'f-box-root-khapye'

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const sheet = createMemorySheet()
  const engine = createEngine(theme, {
    prefix: 'f',
    cache: createCache({ hasLayers: false, hasPruning: false, prefix: 'f', sheet }),
  })
  const style = bindEngine(engine, requestCache)
  const Box = style.styled('div', { name: 'Box' })(({ theme: view }) => ({
    color: view.palette.primary,
    ...at(`@media (width >= ${view.breakpoints[0]})`, { padding: view.space[1] }),
  }))
  return { ...style, sheet, Box }
}

const classOf = (element: ResolvedElement) => element.props.className as string

describe('the server build of styled', () => {
  it('makes the same class as the client build, and renders its style element', async () => {
    const { Box, ThemeProvider } = setup()
    const tree = playScopes(
      await resolveTree(
        <ThemeProvider theme={theme}>
          <Box />
        </ThemeProvider>
      )
    )
    // The outermost provider renders no element.
    const [box] = findAll(tree, 'div')
    expect(classOf(box)).toBe(BOX_CLASS)
    const styles = findAll(tree, 'style')
    const boxStyle = styles.find((element) => element.props.href === BOX_CLASS)
    expect(boxStyle?.props.precedence).toBe('f')
    expect(boxStyle?.children).toEqual([
      `.${BOX_CLASS}{color:var(--f-palette-primary);}@media (width >= 900px){.${BOX_CLASS}{padding:var(--f-space-1);}}`,
    ])
  })

  it('renders the provider with its class, its style element, and its children in order', async () => {
    const { ThemeProvider, engine } = setup()
    const tree = playScopes(
      await resolveTree(
        <ThemeProvider theme={theme}>
          <ThemeProvider theme={theme} className="mine" as="section">
            text
          </ThemeProvider>
        </ThemeProvider>
      )
    )
    const [section] = findAll(tree, 'section')
    expect(classOf(section)).toMatch(/^f-theme-\w+ f-boundary f-scope mine$/)
    expect(section.props.style).toBeUndefined()
    expect(section.children).toEqual(['text'])
    const [root, style] = findAll(tree, 'style')
    expect(root.props.href).toMatch(/^f-root-/)
    expect(style.props.href).toBe(classOf(section).split(' ')[0])
    // The browser part makes the rule from the values: the text the engine gives for that theme.
    expect(style.children).toEqual([
      `.${style.props.href}{${engine.readThemeText(theme).declarations}}`,
    ])
  })

  it('has a nested provider with another breakpoint change nothing for the root', async () => {
    const { Box, ThemeProvider } = setup()
    const tree = playScopes(
      await resolveTree(
        <ThemeProvider theme={theme}>
          <Box />
          <ThemeProvider theme={{ breakpoints: ['500px'] }}>
            <Box />
          </ThemeProvider>
        </ThemeProvider>
      )
    )
    const boxes = findAll(tree, 'div').filter((element) => classOf(element) === BOX_CLASS)
    expect(boxes).toHaveLength(2)
    const providers = findAll(tree, 'div').filter((element) =>
      classOf(element).startsWith('f-theme-')
    )
    // Only the nested provider renders an element.
    expect(providers).toHaveLength(1)
    expect(JSON.stringify(findAll(tree, 'style'))).not.toContain('width >= 500px')
  })

  it('renders a component with object styles with no theme at all', async () => {
    const style = bindEngine(createLazyEngine({ prefix: 'z' }), requestCache)
    const Plain = style.styled('p')({ color: 'red' })
    const tree = playScopes(await resolveTree(<Plain>x</Plain>))
    expect(findAll(tree, 'p')[0].children).toEqual(['x'])
    expect(findAll(tree, 'style')).toHaveLength(1)
  })

  it('merges entries and plain objects of style into the one class, with no style attribute', async () => {
    const style = bindEngine(createEngine(theme, { prefix: 'k', hasLayers: false }), requestCache)
    const { custom } = style.useStyle(style.StyleSheet.create({ custom: { color: 'blue' } }))
    const View = style.styled('div')({ margin: 1 })
    const tree = playScopes(await resolveTree(<View style={[custom, { opacity: 0.7 }]} />))
    const [div] = findAll(tree, 'div')
    expect(div.props.style).toBeUndefined()
    const styles = findAll(tree, 'style')
    expect(styles).toHaveLength(1)
    expect(styles[0].children[0]).toContain('opacity:0.7;')
    expect(classOf(div).split(' ')).toHaveLength(1)
  })

  it('reads the base theme without a provider', async () => {
    const { Box } = setup()
    const tree = playScopes(await resolveTree(<Box />))
    expect(findAll(tree, 'div').map(classOf)).toEqual([BOX_CLASS])
  })

  it('gives useTheme the base theme after a provider rendered, and readTheme is the same function', async () => {
    const engine = createEngine(theme, { prefix: 'm' })
    const style = bindEngine(engine, requestCache)
    const seen: string[] = []
    const Probe = () => {
      seen.push(style.useTheme().breakpoints[0])
      return null
    }
    await resolveTree(
      <style.ThemeProvider theme={{ breakpoints: ['300px'] }}>
        <Probe />
      </style.ThemeProvider>
    )
    expect(seen).toEqual(['900px'])
    expect(style.useTheme()).toBe(theme)
    expect(style.readTheme).toBe(style.useTheme)
  })

  it('gives a function style and useStyle an empty theme without a theme', async () => {
    const style = bindEngine(createLazyEngine({ prefix: 'e' }), requestCache)
    const Box = style.styled('div')(({ theme: view }) => ({
      color: (view as unknown as { palette?: string }).palette ?? 'red',
    }))
    const tree = playScopes(await resolveTree(<Box />))
    expect(classOf(findAll(tree, 'div')[0])).toMatch(/^e-/)
    const dynamic = style.StyleSheet.create((view) => ({
      a: { color: (view as unknown as { palette?: string }).palette ?? 'blue' },
    }))
    expect(style.useStyle(dynamic).a.className).toMatch(/^e-/)
    expect(style.useTheme()).toEqual({})
  })

  it('with no base theme, gives function styles the shape of the first provider of the request, and gives the engine no base theme', async () => {
    const engine = createLazyEngine<typeof theme>({ prefix: 'w' })
    const style = bindEngine(engine, requestCache)
    const Box = style.styled('div')(({ theme: view }) => ({ color: view.palette.primary }))
    const tree = playScopes(
      await resolveTree(
        <style.ThemeProvider theme={theme}>
          <Box />
        </style.ThemeProvider>
      )
    )
    const className = findAll(tree, 'div')[0].props.className as string
    const box = findAll(tree, 'style').find((element) => element.props.href === className)
    expect(box?.children[0]).toContain('color:var(--w-palette-primary);')
    expect(engine.hasTheme).toBe(false)
    // The root rule declares the theme given alone: there is no base theme under it.
    expect(findAll(tree, 'style')[0].children[0]).toContain(
      ':where(:root){--w-palette-primary:#0000ff;--w-space-0:0;--w-space-1:4px;--w-space-2:8px;}'
    )
  })

  it('has useStyle, apply and themeClass', () => {
    const { StyleSheet, useStyle, apply, themeClass, sheet } = setup()
    const dynamic = StyleSheet.create((view) => ({ a: { color: view.palette.primary } }))
    const fixed = StyleSheet.create({ b: { margin: 1 } })
    const { a } = useStyle(dynamic)
    expect(sheet.rules).toContain(`.${a.className}{color:var(--f-palette-primary);}`)
    expect(useStyle(fixed).b.className).toMatch(/^f-/)
    expect(apply(a)).toEqual({ className: a.className })
    expect(apply()).toEqual({ className: undefined })
    expect(themeClass(theme, 'dark')).toMatch(/^f-theme-/)
  })
})

describe('createStyle', () => {
  it('gives a lazy engine the theme, and keeps the theme of an engine that has one', () => {
    const engine = createLazyEngine<typeof theme>({ prefix: 'c' })
    createStyle(theme, { engine })
    expect(engine.baseTheme).toBe(theme)
    const other = { ...theme }
    createStyle(other, { engine })
    expect(engine.baseTheme).toBe(theme)
    expect(createStyle(theme, { prefix: 'n' }).cache.prefix).toBe('n')
  })
})
