import { render } from '@testing-library/react'
import { createCache, createMemorySheet, createSheetEntry } from '@umber-style/core'
import type { CSSProperties } from 'react'
import { renderToString } from 'react-dom/server'
import { createStyle } from './createStyle'

/** A sheet entry typed as what a plain element's `style` takes: the types reject it, a cast gets past them. */
function asStyle(className: string): CSSProperties {
  return createSheetEntry(className) as unknown as CSSProperties
}

describe('a sheet entry given to the style of a plain element', () => {
  it('renders no style attribute on the client', () => {
    const { container } = render(<div style={asStyle('a-1')}>x</div>)
    expect(container.innerHTML).toBe('<div>x</div>')
    const { container: spread } = render(
      <div style={{ ...asStyle('a-1'), ...asStyle('b-2') }}>x</div>
    )
    expect(spread.innerHTML).toBe('<div>x</div>')
  })

  it('renders no style attribute on the server', () => {
    expect(renderToString(<div style={asStyle('a-1')}>x</div>)).toBe('<div>x</div>')
    expect(renderToString(<div style={{ ...asStyle('a-1'), ...asStyle('b-2') }}>x</div>)).toBe(
      '<div>x</div>'
    )
  })

  it('puts nothing on a style object that a script assigns', () => {
    const element = document.createElement('div')
    Object.assign(element.style, asStyle('a-1'))
    expect(element.hasAttribute('style')).toBe(false)
  })
})

describe('a sheet entry given to the style of a styled component', () => {
  it('still becomes the class, alone, in arrays and twice', () => {
    const sheet = createMemorySheet()
    const { styled, engine } = createStyle(
      { palette: { primary: '#0000ff' } },
      { prefix: 'h', cache: createCache({ hasLayers: false, prefix: 'h', sheet }) }
    )
    const entries = engine.createSheet({ one: { color: 'red' }, two: { margin: 1 } }).resolve()
    const Box = styled('div')({ padding: 1 })
    const one = render(<Box style={entries.one}>a</Box>).container.firstElementChild as HTMLElement
    const same = render(<Box style={[entries.one, [entries.one]]}>a</Box>).container
      .firstElementChild as HTMLElement
    const both = render(<Box style={[entries.one, entries.two]}>a</Box>).container
      .firstElementChild as HTMLElement
    expect(one.hasAttribute('style')).toBe(false)
    expect(same.className).toBe(one.className)
    expect(both.className).not.toBe(one.className)
    expect(sheet.rules.join('')).toContain('color:red;')
    expect(sheet.rules.join('')).toContain('margin:1px;')
    expect(renderToString(<Box style={[entries.one, entries.one]}>a</Box>)).toBe(
      `<div class="${one.className}">a</div>`
    )
  })
})
