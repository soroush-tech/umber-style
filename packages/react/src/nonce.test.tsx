import { render } from '@testing-library/react'
import { createStyle } from './createStyle'

describe('the nonce of the client build in the browser', () => {
  it('is on every style element of the engine, which hold the rules of what renders', () => {
    const { styled } = createStyle(
      { palette: { primary: '#0000ff' } },
      {
        prefix: 'nb',
        nonce: 'n0nce',
      }
    )
    const Box = styled('div', { name: 'Box' })(({ theme }) => ({ color: theme.palette.primary }))
    const { container } = render(<Box />)
    const elements = [...document.head.querySelectorAll('style[data-style="nb"]')]
    expect(elements.length).toBeGreaterThan(1)
    expect(elements.every((element) => element.getAttribute('nonce') === 'n0nce')).toBe(true)
    const className = (container.firstElementChild as HTMLElement).className
    expect(elements.map((element) => element.textContent).join('')).toContain(
      `.${className}{color:var(--nb-palette-primary);}`
    )
  })
})
