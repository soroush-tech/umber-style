import {
  createCache,
  createEngine,
  createLazyEngine,
  createMemorySheet,
  NO_THEME_MESSAGE,
} from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle.server'
import { findAll, resolveTree, type ResolvedElement } from './resolveTree'
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
  const engine = createEngine(theme, { prefix: 'f', cache: createCache({ prefix: 'f', sheet }) })
  const style = bindEngine(engine, requestCache)
  const Box = style.styled('div', { name: 'Box' })(({ theme: view }) => ({
    color: view.palette.primary,
    [`@media (width >= ${view.breakpoints[0]})`]: { padding: view.space[1] },
  }))
  return { ...style, sheet, Box }
}

const classOf = (element: ResolvedElement) => element.props.className as string

describe('the server build of styled', () => {
  it('makes the same class as the client build, and renders its style element', async () => {
    const { Box, ThemeProvider } = setup()
    const tree = await resolveTree(
      <ThemeProvider theme={theme}>
        <Box />
      </ThemeProvider>
    )
    const [, box] = findAll(tree, 'div')
    expect(classOf(box)).toBe(BOX_CLASS)
    const styles = findAll(tree, 'style')
    const boxStyle = styles.find((element) => element.props.href === BOX_CLASS)
    expect(boxStyle?.props.precedence).toBe('f')
    expect(boxStyle?.children).toEqual([
      `.${BOX_CLASS}{color:var(--f-palette-primary);}@media (width >= 900px){.${BOX_CLASS}{padding:var(--f-space-1);}}`,
    ])
  })

  it('renders the provider with its class, its style element, and its children in order', async () => {
    const { ThemeProvider, sheet } = setup()
    const tree = await resolveTree(
      <ThemeProvider theme={theme} className="mine" as="section">
        text
      </ThemeProvider>
    )
    const [section] = findAll(tree, 'section')
    expect(classOf(section)).toMatch(/^f-theme-\w+ f-scope mine$/)
    expect(section.props.style).toBeUndefined()
    expect(section.children).toEqual(['text'])
    const [style] = findAll(tree, 'style')
    expect(style.props.href).toBe(classOf(section).split(' ')[0])
    expect(style.children).toEqual([sheet.rules.find((rule) => rule.startsWith('.f-theme-'))])
  })

  it('has a nested provider with another breakpoint change nothing for the root', async () => {
    const { Box, ThemeProvider } = setup()
    const tree = await resolveTree(
      <ThemeProvider theme={theme}>
        <Box />
        <ThemeProvider theme={{ breakpoints: ['500px'] }}>
          <Box />
        </ThemeProvider>
      </ThemeProvider>
    )
    const boxes = findAll(tree, 'div').filter((element) => classOf(element) === BOX_CLASS)
    expect(boxes).toHaveLength(2)
    const providers = findAll(tree, 'div').filter((element) =>
      classOf(element).startsWith('f-theme-')
    )
    expect(providers).toHaveLength(2)
    expect(classOf(providers[0])).not.toBe(classOf(providers[1]))
    expect(JSON.stringify(findAll(tree, 'style'))).not.toContain('width >= 500px')
  })

  it('renders a component with object styles with no theme at all', async () => {
    const style = bindEngine(createLazyEngine({ prefix: 'z' }), requestCache)
    const Plain = style.styled('p')({ color: 'red' })
    const tree = await resolveTree(<Plain>x</Plain>)
    expect(findAll(tree, 'p')[0].children).toEqual(['x'])
    expect(findAll(tree, 'style')).toHaveLength(1)
  })

  it('merges entries and plain objects of style into the one class, with no style attribute', async () => {
    const style = bindEngine(createEngine(theme, { prefix: 'k' }), requestCache)
    const { custom } = style.useStyle(style.StyleSheet.create({ custom: { color: 'blue' } }))
    const View = style.styled('div')({ margin: 1 })
    const tree = await resolveTree(<View style={[custom, { opacity: 0.7 }]} />)
    const [div] = findAll(tree, 'div')
    expect(div.props.style).toBeUndefined()
    const styles = findAll(tree, 'style')
    expect(styles).toHaveLength(1)
    expect(styles[0].children[0]).toContain('opacity:0.7;')
    expect(classOf(div).split(' ')).toHaveLength(1)
  })

  it('reads the base theme without a provider', async () => {
    const { Box } = setup()
    const tree = await resolveTree(<Box />)
    expect(findAll(tree, 'div').map(classOf)).toEqual([BOX_CLASS])
  })

  it('merges a partial root over the base, once for each root', () => {
    const engine = createEngine(theme, { prefix: 'm' })
    const style = bindEngine(engine, requestCache)
    const root = { breakpoints: ['300px'] }
    return resolveTree(
      <style.ThemeProvider theme={root}>
        <i />
      </style.ThemeProvider>
    ).then(() => {
      const read = style.readTheme()
      expect(read.breakpoints).toEqual(['300px'])
      expect(read.palette).toEqual(theme.palette)
      expect(style.readTheme()).toBe(read)
    })
  })

  it('throws without a theme, from a function style and from useStyle', async () => {
    const style = bindEngine(createLazyEngine(), requestCache)
    const Box = style.styled('div')(({ theme: view }) => ({ color: view.palette }))
    await expect(resolveTree(<Box />)).rejects.toThrow(NO_THEME_MESSAGE)
    const dynamic = style.StyleSheet.create((view) => ({ a: { color: view.palette } }))
    expect(() => style.useStyle(dynamic)).toThrow(NO_THEME_MESSAGE)
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
