import { createApp, h, type Component } from 'vue'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const baseTheme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

const ORDER = '@layer v-theme,v-global,v-components,v-overrides;'

function setup(options: { hasLayers?: boolean } = {}) {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, {
    prefix: 'v',
    cache: createCache({ prefix: 'v', sheet, ...options }),
  })
  const Button = style.styled('button', { name: 'Button' })({
    background: 'blue',
    color: 'white',
    '&:hover': { background: 'red' },
  })
  return { ...style, sheet, Button }
}

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

describe('the layers of a styled component in Vue', () => {
  it('beats the hover of a Button with a background in style: two classes, two layers', () => {
    const { Button, sheet } = setup()
    const root = mount(() => h(Button, { style: { background: 'purple' } }, () => 'go'))
    const element = root.firstElementChild as HTMLElement
    const [component, override, ...rest] = element.className.split(' ')
    expect(rest).toEqual([])
    expect(element.hasAttribute('style')).toBe(false)
    expect(sheet.rules).toEqual([
      ORDER,
      `@layer v-components{.${component}{background:blue;color:white;}}`,
      `@layer v-components{.${component}:hover{background:red;}}`,
      `@layer v-overrides{.${override}{background:purple;}}`,
    ])
  })

  it('has one class with nothing from outside', () => {
    const { Button } = setup()
    const root = mount(() => h(Button, null, () => 'plain'))
    expect((root.firstElementChild as HTMLElement).className.split(' ')).toHaveLength(1)
  })

  it('merges entries, a plain object and a class into one override class, keeping a foreign class', () => {
    const { Button, StyleSheet, useStyle, cache } = setup()
    const { a, b } = useStyle(
      StyleSheet.create({ a: { color: 'red', margin: 1 }, b: { color: 'green', padding: 2 } })
    )
    const root = mount(() =>
      h(Button, { style: [a, b, { color: 'black' }], class: 'foreign' }, () => 'x')
    )
    const classes = (root.firstElementChild as HTMLElement).className.split(' ')
    expect(classes).toHaveLength(3)
    expect(classes).toContain('foreign')
    expect(cache.registered.get(classes.at(-1) as string)).toMatchObject({
      color: 'black',
      margin: 1,
      padding: 2,
    })
  })

  it('makes one component class for a styled component wrapped in another', () => {
    const { Button, styled, cache } = setup()
    const Primary = styled(Button, { name: 'Primary' })({ color: 'gold' })
    const root = mount(() => h(Primary, null, () => 'x'))
    const classes = (root.firstElementChild as HTMLElement).className.split(' ')
    expect(classes).toHaveLength(1)
    expect(cache.registered.get(classes[0] as string)).toMatchObject({
      background: 'blue',
      color: 'gold',
    })
  })

  it('keeps one merged class and no layer with hasLayers: false', () => {
    const { Button, sheet } = setup({ hasLayers: false })
    const root = mount(() => h(Button, { style: { background: 'purple' } }, () => 'flat'))
    expect((root.firstElementChild as HTMLElement).className.split(' ')).toHaveLength(1)
    expect(sheet.rules.join('')).not.toContain('@layer')
  })
})
