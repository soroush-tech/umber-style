import { createCache, createEngine, createMemorySheet, isSheetEntry } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { findAll, resolveTree, type ResolvedElement } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff' } }

/** What `css` throws for a function, as an argument or as an interpolation: the message of every binding. */
const FUNCTION_ERROR = new TypeError(
  "css(): a function is not a style here, as an argument or as an interpolation: css() makes a class with no component, so it has no props or theme to call it with. For a value of the props, use a styled component's style function; for a value of the theme, give an entry of StyleSheet.create((theme) => ...) to the style prop."
)

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const sheet = createMemorySheet()
  const engine = createEngine(theme, {
    prefix: 'f',
    cache: createCache({ hasLayers: false, prefix: 'f', sheet }),
  })
  return { ...bindEngine(engine, requestCache), sheet }
}

const classOf = (element: ResolvedElement) => element.props.className as string

describe('css in the server build', () => {
  it('returns an entry that a styled component takes in style, with its style element', async () => {
    const { css, styled } = setup()
    const card = css({ padding: 8 }, [{ color: 'red' }])
    expect(isSheetEntry(card)).toBe(true)
    const Box = styled('div')(card)
    const tree = await resolveTree(<Box />)
    const [box] = findAll(tree, 'div')
    expect(classOf(box)).toBe(card.className)
    expect(findAll(tree, 'style')[0].children).toEqual([
      `.${card.className}{padding:8px;color:red;}`,
    ])
  })

  it('reads a tagged template, and throws for a function in it or given to it', () => {
    const { css } = setup()
    expect(
      css`
        padding: 8px;
      `.className
    ).toBe(css({ padding: 8 }).className)
    expect(
      () => css`
        color: ${(() => 'red') as never};
      `
    ).toThrow(FUNCTION_ERROR)
    expect(() => css((() => ({ color: 'red' })) as never)).toThrow(FUNCTION_ERROR)
  })
})

describe('the template form of styled in the server build', () => {
  it('gives the class of the equal object style, and a props class for a function of the props', async () => {
    const { styled } = setup()
    const Template = styled('div')`
      color: red;
    `
    const Object = styled('div')({ color: 'red' })
    const Title = styled('h1')<{ tone: string }>`
      color: ${({ tone }) => tone};
    `
    const tree = await resolveTree(
      <>
        <Template />
        <Object />
        <Title tone="red" />
        <Title tone="blue" />
      </>
    )
    const [template, object] = findAll(tree, 'div')
    expect(classOf(template)).toBe(classOf(object))
    const [red, blue] = findAll(tree, 'h1')
    expect(classOf(red)).not.toBe(classOf(blue))
  })

  it('makes a styled component a selector: its target, else its class, else a TypeError', () => {
    const { styled } = setup()
    expect(String(styled('span', { target: 'icon' })(() => ({ color: 'red' })))).toBe('.icon')
    const Plain = styled('span')({ color: 'red' })
    expect(String(Plain)).toBe(`.${createEngine(theme, { prefix: 'f' }).css({ color: 'red' })}`)
    expect(() => String(styled('span')(() => ({ color: 'red' })))).toThrow(TypeError)
  })

  it('takes the template form of keyframes and globalStyles', () => {
    const { keyframes, globalStyles } = setup()
    expect(keyframes`to { opacity: 1; }`).toBe(keyframes({ to: { opacity: 1 } }))
    expect(globalStyles`body { margin: 0; }`.id).toBe(globalStyles({ body: { margin: '0' } }).id)
  })
})
