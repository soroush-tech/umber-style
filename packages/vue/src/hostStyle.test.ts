import { createApp, createSSRApp, h, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createCache, createMemorySheet, createSheetEntry } from '@umber-style/core'
import { createStyle } from './createStyle'

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

describe('a sheet entry given to the style of a plain element', () => {
  it('renders no style attribute on the client, alone or in an array', () => {
    const a = createSheetEntry('a-1')
    const b = createSheetEntry('b-2')
    expect(mount(() => h('div', { style: a }, 'x')).innerHTML).toBe('<div>x</div>')
    expect(mount(() => h('div', { style: [a, b] }, 'x')).innerHTML).toBe('<div>x</div>')
    expect(mount(() => h('div', { style: [a, [b, { ...a }]] }, 'x')).innerHTML).toBe('<div>x</div>')
  })

  it('renders on the server what Vue renders for no style at all, alone or in an array', async () => {
    const a = createSheetEntry('a-1')
    const b = createSheetEntry('b-2')
    // Vue's server renderer writes `style=""` for any `style` prop, even null: that is Vue's, not the entry's.
    const empty = await renderToString(createSSRApp(() => h('div', { style: null }, 'x')))
    expect(empty).toBe('<div style="">x</div>')
    for (const style of [a, [a, b], [a, [b]]]) {
      const html = await renderToString(createSSRApp(() => h('div', { style }, 'x')))
      expect(html).toBe(empty)
    }
  })

  it('puts nothing on a style object that a script assigns', () => {
    const element = document.createElement('div')
    Object.assign(element.style, createSheetEntry('a-1'))
    expect(element.hasAttribute('style')).toBe(false)
  })
})

describe('a sheet entry given to the style of a styled component', () => {
  it('still becomes the class, alone, in arrays and twice', async () => {
    const sheet = createMemorySheet()
    const { styled, engine } = createStyle(
      { palette: { primary: '#0000ff' } },
      { prefix: 'h', cache: createCache({ hasLayers: false, prefix: 'h', sheet }) }
    )
    const entries = engine.createSheet({ one: { color: 'red' }, two: { margin: 1 } }).resolve()
    const Box = styled('div')({ padding: 1 })
    const classOf = (style: unknown) =>
      (mount(() => h(Box, { style }, () => 'a')).firstElementChild as HTMLElement).className
    const one = classOf(entries.one)
    expect(classOf([entries.one, [entries.one]])).toBe(one)
    expect(classOf([entries.one, entries.two])).not.toBe(one)
    expect(sheet.rules.join('')).toContain('color:red;')
    expect(sheet.rules.join('')).toContain('margin:1px;')
    const html = await renderToString(
      createSSRApp(() => h(Box, { style: [entries.one, entries.one] }, () => 'a'))
    )
    expect(html).toBe(`<div class="${one}">a</div>`)
  })
})
