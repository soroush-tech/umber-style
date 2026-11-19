import { render, screen } from '@testing-library/react'
import { createCache, createEngine, createMemorySheet, createStyleTag } from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

/** What `useStyle` returns for `sheet`, read in a component. */
function readSheet<T>(useStyle: (sheet: never) => T, sheet: unknown): T {
  let result: T | undefined
  const Probe = () => {
    result = useStyle(sheet as never)
    return null
  }
  render(<Probe />)
  return result as T
}

const baseTheme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

const ORDER = '@layer l-theme,l-global,l-components,l-overrides;'

afterEach(() => {
  document.head.innerHTML = ''
})

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, {
    prefix: 'l',
    cache: createCache({ hasPruning: false, prefix: 'l', sheet }),
  })
  const Button = style.styled('button', { name: 'Button' })({
    background: 'blue',
    color: 'white',
    '&:hover': { background: 'red' },
  })
  const layerOf = (className: string) =>
    sheet.rules.find((rule) => rule.includes(`.${className}{`))?.match(/^@layer ([\w-]+)\{/)?.[1]
  return { ...style, sheet, Button, layerOf }
}

describe('the layers of a styled component', () => {
  it('beats the hover of a Button with a background in style: two classes, two layers', () => {
    const { Button, sheet } = setup()
    render(<Button style={{ background: 'purple' }}>go</Button>)
    const element = screen.getByText('go')
    const [component, override, ...rest] = element.className.split(' ')
    expect(rest).toEqual([])
    expect(component).toMatch(/^l-button-root-/)
    expect(override).toMatch(/^l-button-root-/)
    expect(element.hasAttribute('style')).toBe(false)
    expect(sheet.rules).toEqual([
      ORDER,
      `@layer l-components{.${component}{background:blue;color:white;}}`,
      `@layer l-components{.${component}:hover{background:red;}}`,
      `@layer l-overrides{.${override}{background:purple;}}`,
    ])
  })

  it('has one class for an element with nothing from outside, made once', () => {
    const { Button, sheet } = setup()
    render(
      <>
        <Button>one</Button>
        <Button>two</Button>
      </>
    )
    const one = screen.getByText('one').className
    expect(one.split(' ')).toHaveLength(1)
    expect(screen.getByText('two').className).toBe(one)
    expect(
      sheet.rules.filter((rule) => rule.startsWith(`@layer l-components{.${one}{`))
    ).toHaveLength(1)
  })

  it('merges two sheet entries and a plain object of style into one override class', () => {
    const { Button, StyleSheet, useStyle, cache } = setup()
    const { a, b } = readSheet(
      useStyle,
      StyleSheet.create({ a: { color: 'red', margin: 1 }, b: { color: 'green', padding: 2 } })
    )
    render(<Button style={[a, b, { color: 'black' }]}>three</Button>)
    const classes = screen.getByText('three').className.split(' ')
    expect(classes).toHaveLength(2)
    expect(cache.registered.get(classes[1] as string)).toEqual({
      label: 'button-root',
      color: 'black',
      margin: 1,
      padding: 2,
    })
  })

  it('resolves an engine class of className into the override class and keeps a foreign one', () => {
    const { Button, cache, layerOf } = setup()
    const other = cache.css({ margin: 3 })
    render(
      <Button className={`foreign ${other}`} style={{ padding: 1 }}>
        mixed
      </Button>
    )
    const classes = screen.getByText('mixed').className.split(' ')
    expect(classes).toHaveLength(3)
    expect(classes).toContain('foreign')
    const override = classes.at(-1) as string
    expect(layerOf(override)).toBe('l-overrides')
    expect(cache.registered.get(override)).toMatchObject({ margin: 3, padding: 1 })
  })

  it('resolves the classes of another styled component, given as className', () => {
    const { Button, styled, layerOf, cache } = setup()
    const Card = styled('div', { name: 'Card' })({ margin: 4 })
    render(<Card data-testid="card" style={{ padding: 2 }} />)
    const cardClass = screen.getByTestId('card').className
    render(<Button className={cardClass}>wrapped</Button>)
    const classes = screen.getByText('wrapped').className.split(' ')
    expect(classes).toHaveLength(2)
    expect(layerOf(classes[1] as string)).toBe('l-overrides')
    expect(cache.registered.get(classes[1] as string)).toMatchObject({ margin: 4, padding: 2 })
  })

  it('makes one component class for a styled component wrapped in another', () => {
    const { Button, styled, cache, layerOf } = setup()
    const Primary = styled(Button, { name: 'Primary' })({ color: 'gold' })
    render(<Primary>wrapped</Primary>)
    const classes = screen.getByText('wrapped').className.split(' ')
    expect(classes).toHaveLength(1)
    expect(layerOf(classes[0] as string)).toBe('l-components')
    expect(cache.registered.get(classes[0] as string)).toMatchObject({
      background: 'blue',
      color: 'gold',
    })
  })

  it('puts sheet entries and apply() in the components layer, theme classes in the theme layer', () => {
    const { apply, StyleSheet, useStyle, ThemeProvider, layerOf, sheet } = setup()
    const { box } = readSheet(useStyle, StyleSheet.create({ box: { color: 'red' } }))
    const { className } = apply(box, { margin: 1 })
    expect(layerOf(box.className)).toBe('l-components')
    expect(layerOf(className as string)).toBe('l-components')
    render(<ThemeProvider theme={baseTheme}>x</ThemeProvider>)
    const themed = sheet.rules.filter((rule) => rule.startsWith('@layer l-theme{'))
    expect(themed).toHaveLength(2)
    expect(themed.some((rule) => rule.includes('.l-scope{display:contents;}'))).toBe(true)
  })
})

describe('the classes of the client build', () => {
  it('are the ones the server build makes for the same component (see layers.server.test.tsx)', () => {
    const { styled } = createStyle(baseTheme, {
      prefix: 's',
      cache: createCache({ prefix: 's', sheet: createMemorySheet() }),
    })
    const Button = styled('button', { name: 'Button' })({
      background: 'blue',
      '&:hover': { background: 'red' },
    })
    render(<Button style={{ background: 'purple' }}>same</Button>)
    expect(screen.getByText('same').className).toBe('s-button-root-av9c6p s-button-root-8td0qu')
  })
})

describe('the layers in the browser sheet', () => {
  it('declares the order first in the DOM sheet, and wraps each rule in its layer', () => {
    const style = createStyle(baseTheme, { prefix: 'd' })
    const Button = style.styled('button')({ color: 'red' })
    render(<Button style={{ color: 'blue' }}>dom</Button>)
    const element = document.querySelector<HTMLStyleElement>('style[data-style="d"]')
    const rules = [...(element?.sheet?.cssRules ?? [])]
    expect(rules.map((rule) => rule.constructor.name)).toEqual([
      'CSSLayerStatementRule',
      'CSSLayerBlockRule',
      'CSSLayerBlockRule',
    ])
    expect(rules[0]?.cssText).toBe('@layer d-theme, d-global, d-components, d-overrides;')
    expect(rules.slice(1).map((rule) => (rule as CSSGroupingRule).cssRules.length)).toEqual([1, 1])
  })

  it('does not insert the order statement or a rule again after a server render', () => {
    const server = bindEngine(
      createEngine(baseTheme, {
        prefix: 'h',
        cache: createCache({ prefix: 'h', sheet: createMemorySheet() }),
      })
    )
    const Box = server.styled('div')({ color: 'red' })
    render(<Box style={{ margin: 1 }} />).unmount()
    const tag = createStyleTag(server.cache)
    expect(tag).toContain('data-ids="')
    expect(tag).toContain('h-layers')
    document.head.innerHTML = tag
    const element = document.querySelector('style[data-style="h"]') as HTMLStyleElement
    const before = element.sheet?.cssRules.length
    expect(before).toBe(3)
    const client = bindEngine(createEngine(baseTheme, { prefix: 'h' }))
    const Again = client.styled('div')({ color: 'red' })
    render(<Again style={{ margin: 1 }} />)
    expect(element.sheet?.cssRules.length).toBe(before)
  })
})

describe('hasLayers: false', () => {
  it('keeps one merged class and writes no layer, from createStyle', () => {
    const sheet = createMemorySheet()
    const { styled } = createStyle(baseTheme, {
      prefix: 'n',
      cache: createCache({ hasLayers: false, prefix: 'n', sheet }),
    })
    const Button = styled('button')({ background: 'blue', '&:hover': { background: 'red' } })
    render(<Button style={{ background: 'purple' }}>flat</Button>)
    expect(screen.getByText('flat').className.split(' ')).toHaveLength(1)
    expect(sheet.rules.join('')).not.toContain('@layer')
  })

  it('is an option of createStyle and of configure', () => {
    expect(createStyle(baseTheme, { prefix: 'o', hasLayers: false }).cache.hasLayers).toBe(false)
    expect(createStyle(baseTheme, { prefix: 'p' }).cache.hasLayers).toBe(true)
    const style = createDefaultStyle()
    style.configure({ prefix: 'q', hasLayers: false })
    expect(style.getEngine().cache.hasLayers).toBe(false)
  })
})
