import { render, screen } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { CacheProvider } from './index'

describe('CacheProvider on React Native', () => {
  it('renders its children, so that one source runs on both platforms', () => {
    const cache = createCache({ prefix: 'app', sheet: createMemorySheet() })
    render(
      <CacheProvider value={cache}>
        <span>child</span>
      </CacheProvider>
    )
    expect(screen.getByText('child')).toBeTruthy()
    expect(cache.extract().css).toBe('')
  })
})
