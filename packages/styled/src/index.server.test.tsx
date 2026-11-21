import * as react from '@umber-style/react'
import styled from './index'

describe('the default export under the react-server condition', () => {
  it('is the styled of the server build', () => {
    expect(styled).toBe(react.styled)
    expect('readTheme' in react).toBe(true)
    expect('ThemeContext' in react).toBe(false)
    expect(typeof styled.div).toBe('function')
  })
})
