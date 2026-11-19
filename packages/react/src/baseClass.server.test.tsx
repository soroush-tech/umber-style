import { createCache, createEngine, createLazyEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { createDefaultStyle } from './defaultStyle.server'
import { findAll, resolveTree, type ResolvedElement } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { palette: { primary: '#0000ff' } }

const ORDER = '@layer s-theme,s-global,s-components,s-overrides;'

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup(options: { hasLabels?: boolean } = {}) {
  const engine = createEngine(theme, {
    prefix: 's',
    cache: createCache({ prefix: 's', sheet: createMemorySheet(), ...options }),
  })
  return bindEngine(engine, requestCache)
}

const classOf = (element: ResolvedElement) => element.props.className as string
const hrefs = (tree: Awaited<ReturnType<typeof resolveTree>>) =>
  findAll(tree, 'style').map((element) => element.props.href)

describe('the server build with a base class and a props class', () => {
  it('emits the style element of the base first, then the props class, then the override class', async () => {
    const { styled, StyleSheet } = setup()
    const sheet = StyleSheet.create({ danger: { color: 'red' } })
    const Flex = styled('div', { name: 'Flex' })<{ gap?: number }>(
      { display: 'flex' },
      ({ gap }) => ({ gap })
    )
    const tree = await resolveTree(<Flex gap={4} style={sheet.danger} />)
    const [base, props, override, ...rest] = classOf(findAll(tree, 'div')[0]).split(' ')
    expect(rest).toEqual([])
    expect(hrefs(tree)).toEqual([base, props, override])
    const styles = findAll(tree, 'style')
    expect(styles.map((element) => element.children)).toEqual([
      [`${ORDER}@layer s-components{.${base}{display:flex;}}`],
      [`${ORDER}@layer s-components{.${props}{gap:4px;}}`],
      [`${ORDER}@layer s-overrides{.${override}{color:red;}}`],
    ])
  })

  it('emits only the override-role rule for an entry that is only given through style', async () => {
    const { styled, StyleSheet } = setup()
    const sheet = StyleSheet.create({ danger: { color: 'red' } })
    const Box = styled('div')({ margin: 1 })
    const tree = await resolveTree(
      <>
        <Box style={sheet.danger} />
        <Box style={sheet.danger} />
      </>
    )
    // React renders each href once; the two elements here have the same one.
    const unique = new Map(
      findAll(tree, 'style').map((element) => [element.props.href, String(element.children[0])])
    )
    const css = [...unique.values()]
    expect(css.filter((text) => text.includes('color:red'))).toHaveLength(1)
    expect(
      css.filter((text) => text.includes('s-overrides{') && text.includes('color:red'))
    ).toHaveLength(1)
    expect(css.some((text) => text.includes('s-components{') && text.includes('color:red'))).toBe(
      false
    )
  })

  it('keeps each base before its props class in the order of the elements, even for the same props result', async () => {
    const { styled } = setup({ hasLabels: false })
    const props = ({ tone }: { tone?: string }) => ({ color: tone })
    const A = styled('div')<{ tone?: string }>({ margin: 1 }, props)
    const B = styled('p')<{ tone?: string }>({ margin: 2 }, props)
    const tree = await resolveTree(
      <>
        <A tone="red" />
        <B tone="red" />
      </>
    )
    const order = hrefs(tree)
    const [baseA, propsA] = classOf(findAll(tree, 'div')[0]).split(' ')
    const [baseB, propsB] = classOf(findAll(tree, 'p')[0]).split(' ')
    expect(propsA).not.toBe(propsB)
    expect(order.indexOf(baseA)).toBeLessThan(order.indexOf(propsA))
    expect(order.indexOf(baseB)).toBeLessThan(order.indexOf(propsB))
    expect(new Set(order).size).toBe(order.length)
  })

  it('takes the base of a component from the root theme of the request, for a function that reads only the theme', async () => {
    const { styled, ThemeProvider } = setup()
    const Card = styled('div')<{ gap?: number }>(
      ({ theme: view }: { theme: typeof theme }) => ({ color: view.palette.primary }),
      ({ gap }) => ({ gap })
    )
    const tree = await resolveTree(
      <ThemeProvider theme={theme}>
        <Card gap={1} />
      </ThemeProvider>
    )
    const [base, props] = classOf(findAll(tree, 'div')[0]).split(' ')
    expect(findAll(tree, 'style').some((element) => element.props.href === base)).toBe(true)
    expect(props).toBeDefined()
  })
})

describe('an object sheet on the server needs no theme', () => {
  it('works with an engine that has none, and with no provider', async () => {
    const engine = createLazyEngine({
      prefix: 's',
      cache: createCache({ prefix: 's', sheet: createMemorySheet() }),
    })
    const { styled, StyleSheet, useStyle } = bindEngine(engine, requestCache)
    const sheet = StyleSheet.create({ danger: { color: 'red' } })
    expect(useStyle(sheet)).toBe(sheet)
    const Box = styled('div')({ margin: 1 })
    const tree = await resolveTree(<Box style={sheet.danger} />)
    expect(classOf(findAll(tree, 'div')[0]).split(' ')).toHaveLength(2)
    expect(engine.hasTheme).toBe(false)
  })

  it('resolves a sheet made from a function of the theme with the theme of the request', () => {
    const { StyleSheet, useStyle, ThemeProvider } = setup()
    expect(ThemeProvider).toBeDefined()
    const sheet = StyleSheet.create((view) => ({ box: { color: view.palette.primary } }))
    expect(useStyle(sheet).box.className).toMatch(/^s-/)
  })

  it('is made on first read on the default server style, so a module can create it before configure', () => {
    const style = createDefaultStyle()
    const sheet = style.StyleSheet.create({ box: { color: 'red' } })
    expect(() => style.configure({ prefix: 'late' })).not.toThrow()
    expect(sheet.box.className).toMatch(/^late-/)
    expect(style.useStyle(sheet)).toBe(sheet)
  })
})
