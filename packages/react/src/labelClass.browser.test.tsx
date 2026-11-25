import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createStyle } from './createStyle'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('a component whose label has characters that a class name cannot hold', () => {
  it('has one class, and its rule applies, for a dot and for a space', async () => {
    const { styled, ThemeProvider } = createStyle({}, { prefix: 'lc' })
    const Title = styled('p', { label: 'card.title' })({ color: 'rgb(255, 0, 0)' })
    const Header = styled('p', { label: 'Card Header' })({ color: 'rgb(0, 0, 255)' })
    const container = document.createElement('div')
    document.body.appendChild(container)
    await act(async () => {
      createRoot(container).render(
        <ThemeProvider theme={{}} isRoot>
          <Title data-testid="title">a</Title>
          <Header data-testid="header">b</Header>
        </ThemeProvider>
      )
    })
    const title = container.querySelector('[data-testid="title"]') as HTMLElement
    const header = container.querySelector('[data-testid="header"]') as HTMLElement
    expect(title.className).toMatch(/^lc-card-title-[a-z0-9]+$/)
    expect(header.className).toMatch(/^lc-Card-Header-[a-z0-9]+$/)
    expect(title.classList).toHaveLength(1)
    expect(header.classList).toHaveLength(1)
    expect(getComputedStyle(title).color).toBe('rgb(255, 0, 0)')
    expect(getComputedStyle(header).color).toBe('rgb(0, 0, 255)')
  })
})
