import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree, type ResolvedElement } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { palette: { primary: '#0000ff' } }

const ORDER = '@layer s-theme,s-global,s-components,s-overrides;'

/** The classes of the Button below with a purple background: layers.test.tsx makes the same in the client build. */
const SERVER_CLASSES = 's-button-root-av9c6p s-button-root-8td0qu'

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup(options: { hasLayers?: boolean } = {}) {
  const engine = createEngine(theme, {
    prefix: 's',
    cache: createCache({ prefix: 's', sheet: createMemorySheet(), ...options }),
  })
  const style = bindEngine(engine, requestCache)
  const Button = style.styled('button', { name: 'Button' })({
    background: 'blue',
    '&:hover': { background: 'red' },
  })
  return { ...style, Button }
}

const classOf = (element: ResolvedElement) => element.props.className as string

describe('the server build with layers', () => {
  it('emits a style element for the component class and one for the override class', async () => {
    const { Button } = setup()
    const tree = await resolveTree(<Button style={{ background: 'purple' }}>go</Button>)
    const [button] = findAll(tree, 'button')
    const [component, override, ...rest] = classOf(button).split(' ')
    expect(rest).toEqual([])
    expect(button.props.style).toBeUndefined()
    const styles = findAll(tree, 'style')
    expect(styles.map((element) => element.props.href)).toEqual([component, override])
    expect(styles.every((element) => element.props.precedence === 's')).toBe(true)
    expect(styles.map((element) => element.children)).toEqual([
      [
        `${ORDER}@layer s-components{.${component}{background:blue;}}` +
          `@layer s-components{.${component}:hover{background:red;}}`,
      ],
      [`${ORDER}@layer s-overrides{.${override}{background:purple;}}`],
    ])
  })

  it('starts the element of a theme class and of the scope with the order statement', async () => {
    const { ThemeProvider } = setup()
    const tree = await resolveTree(<ThemeProvider theme={theme}>x</ThemeProvider>)
    const styles = findAll(tree, 'style')
    expect(styles).toHaveLength(2)
    for (const element of styles) {
      expect(element.children[0]).toMatch(
        /^@layer s-theme,s-global,s-components,s-overrides;@layer s-theme\{/
      )
    }
  })

  it('gives the class names that the client build gives (see layers.test.tsx)', async () => {
    const { Button } = setup()
    const tree = await resolveTree(<Button style={{ background: 'purple' }} />)
    expect(classOf(findAll(tree, 'button')[0])).toBe(SERVER_CLASSES)
  })

  it('has one class and one element for a Button with nothing from outside', async () => {
    const { Button } = setup()
    const tree = await resolveTree(<Button>plain</Button>)
    expect(classOf(findAll(tree, 'button')[0]).split(' ')).toHaveLength(1)
    expect(findAll(tree, 'style')).toHaveLength(1)
  })
})

describe('the server build with hasLayers: false', () => {
  it('emits one element with no order statement and no layer', async () => {
    const { Button } = setup({ hasLayers: false })
    const tree = await resolveTree(<Button style={{ background: 'purple' }}>go</Button>)
    const styles = findAll(tree, 'style')
    expect(styles).toHaveLength(1)
    expect(String(styles[0].children[0])).not.toContain('@layer')
    expect(classOf(findAll(tree, 'button')[0]).split(' ')).toHaveLength(1)
  })
})
