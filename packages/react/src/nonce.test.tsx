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

describe('the nonce of the page, for the client build with none', () => {
  // The elements of another test are style elements with a nonce the page let in: a page nonce too.
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('is on every style element of the engine on a page whose scripts carry one', () => {
    const script = document.createElement('script')
    script.setAttribute('nonce', 'page')
    document.head.append(script)
    const { styled } = createStyle({ palette: { primary: '#0000ff' } }, { prefix: 'np' })
    const Box = styled('div', { name: 'Box' })(({ theme }) => ({ color: theme.palette.primary }))
    const { container } = render(<Box />)
    const elements = [...document.head.querySelectorAll('style[data-style="np"]')]
    expect(elements.length).toBeGreaterThan(1)
    expect(elements.every((element) => element.getAttribute('nonce') === 'page')).toBe(true)
    const className = (container.firstElementChild as HTMLElement).className
    expect(elements.map((element) => element.textContent).join('')).toContain(`.${className}{`)
  })

  it('is none on a page with no nonce', () => {
    const { styled } = createStyle({}, { prefix: 'nq' })
    const Box = styled('div', { name: 'Box' })({ color: 'red' })
    render(<Box />)
    const elements = [...document.head.querySelectorAll('style[data-style="nq"]')]
    expect(elements.length).toBeGreaterThan(0)
    expect(elements.some((element) => element.hasAttribute('nonce'))).toBe(false)
  })
})
