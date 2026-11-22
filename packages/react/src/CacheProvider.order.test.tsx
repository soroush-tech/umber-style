import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'

// This file renders its first CacheProvider in the middle of a test: the module that remembers that one
// has rendered is fresh for each test file.

const theme = { palette: { primary: '#0000ff' } }

describe('a component mounted before the first CacheProvider renders', () => {
  it('keeps its hooks in order when it renders again after it, and keeps the engine cache', () => {
    const own = createMemorySheet()
    const style = createStyle(theme, { cache: createCache({ prefix: 'own', sheet: own }) })
    const Static = style.styled('p')({ margin: 1 })
    const Dynamic = style.styled('p')(({ theme: view }) => ({ color: view.palette.primary }))
    let renderAgain: () => void = () => undefined
    function App() {
      const [count, setCount] = useState(0)
      renderAgain = () => setCount(count + 1)
      return (
        <style.ThemeProvider theme={theme}>
          <style.Global styles={{ body: { margin: count } }} />
          <Static data-count={count} />
          <Dynamic />
        </style.ThemeProvider>
      )
    }
    const error = vi.spyOn(console, 'error')
    const { container } = render(<App />)
    const before = container.innerHTML
    const sub = createCache({ prefix: 'sub', sheet: createMemorySheet() })
    render(
      <CacheProvider value={sub}>
        <Static />
      </CacheProvider>
    )
    act(() => renderAgain())
    expect(error).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(before.replace('data-count="0"', 'data-count="1"'))
    expect(own.rules.join('')).toContain('{body{margin:1px;}}')
  })
})
