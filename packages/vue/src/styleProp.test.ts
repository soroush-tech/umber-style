import { createApp, h, type Component } from 'vue'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const baseTheme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, { prefix: 's', cache: createCache({ prefix: 's', sheet }) })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  const classes = style.useStyle(
    style.StyleSheet.create((theme) => ({
      container: { padding: theme.space[2] },
      loud: { color: 'blue' },
    }))
  )
  return { ...style, ruleOf, classes }
}

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

describe('the style attribute of a styled component', () => {
  it('turns sheet entries into the one class and keeps plain objects inline', () => {
    const { styled, classes, ruleOf } = setup()
    const View = styled('div', { name: 'View' })({ color: 'red', margin: 1 })
    const root = mount(() =>
      h(View, {
        style: [classes.container, false, [classes.loud], { opacity: 0.9 }],
        class: 'external',
      })
    )
    const element = root.firstElementChild as HTMLElement
    const [external, engineClass] = element.className.split(' ')
    expect(external).toBe('external')
    expect(ruleOf(engineClass)).toBe(
      `.${engineClass}{margin:1px;padding:var(--s-space-2);color:blue;opacity:0.9;}`
    )
    expect(element.hasAttribute('style')).toBe(false)
  })

  it('renders no style attribute for entries only, and throws for a text style', () => {
    const { styled, classes } = setup()
    const View = styled('div')({ color: 'red' })
    expect(
      mount(() => h(View, { style: classes.container })).firstElementChild?.hasAttribute('style')
    ).toBe(false)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() => mount(() => h(View, { style: 'width: 3px' }))).toThrow('cannot be merged')
    warn.mockRestore()
  })
})

describe('overriding a Button through style', () => {
  it('wins on its own properties, keeps the rest and the label, in one class', () => {
    const { styled, StyleSheet, useStyle, ruleOf } = setup()
    const Button = styled('button', { name: 'Button' })({
      background: 'blue',
      borderRadius: 8,
      padding: 4,
      '&:hover:not(:disabled)': { background: 'darkblue' },
    })
    const styles = useStyle(
      StyleSheet.create({
        custom: { background: 'rebeccapurple', borderRadius: 0 },
        hover: { '&:hover:not(:disabled)': { background: 'rebeccapurple' } },
      })
    )
    const root = mount(() =>
      h('div', null, [
        h(Button, { style: styles.custom }, () => 'custom'),
        h(Button, { style: [styles.custom, styles.hover, { opacity: 0.7 }] }, () => 'own'),
      ])
    )
    const [custom, own] = [...root.querySelectorAll('button')]
    expect(custom.className).toMatch(/^s-button-root-/)
    expect(custom.className.split(' ')).toHaveLength(1)
    expect(ruleOf(custom.className)).toBe(
      `.${custom.className}{padding:4px;background:rebeccapurple;border-radius:0;}`
    )
    expect(ruleOf(`${custom.className}:hover:not(:disabled)`)).toBe(
      `.${custom.className}:hover:not(:disabled){background:darkblue;}`
    )
    expect(ruleOf(`${own.className}:hover:not(:disabled)`)).toBe(
      `.${own.className}:hover:not(:disabled){background:rebeccapurple;}`
    )
    expect(own.hasAttribute('style')).toBe(false)
    expect(ruleOf(own.className.split(' ')[0])).toContain('opacity:0.7;')
  })
})
