// @vitest-environment node
import * as binding from '@umber-style/react/next'
import * as next from './react-next'

describe('umber-style/react/next', () => {
  it('is the Next.js entry of the React binding, the same component', () => {
    expect(Object.keys(next)).toEqual(['StyleRegistry'])
    expect(next.StyleRegistry).toBe(binding.StyleRegistry)
  })
})
