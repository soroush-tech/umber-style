import { render } from '@testing-library/react'
import { createStyle } from './createStyle'

describe('the nonce of the client build in the browser', () => {
  it('is on the style element of the engine, which holds the rules of what renders', () => {
    const { styled } = createStyle(
      { palette: { primary: '#0000ff' } },
      {
        prefix: 'nb',
        nonce: 'n0nce',
      }
    )
    const Box = styled('div', { name: 'Box' })(({ theme }) => ({ color: theme.palette.primary }))
    const { container } = render(<Box />)
    const element = document.head.querySelector('style[data-style="nb"]')
    expect(element?.getAttribute('nonce')).toBe('n0nce')
    const className = (container.firstElementChild as HTMLElement).className
    expect(element?.textContent).toContain(`.${className}{color:var(--nb-palette-primary);}`)
  })
})
