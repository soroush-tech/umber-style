import { render } from '@testing-library/react'
import isPropValid from '@umber-style/is-prop-valid/react-native'
import { createStyle } from './createStyle'

// The React Native example of docs/prop-filters.md, with a stand-in for View that records its props: the
// binding forwards every prop by default, and the entry is given as shouldForwardProp.

const theme = { palette: { primary: '#1b5fd1' } }

/** A stand-in for `View`: it records the props it gets. */
function createView() {
  const calls: Record<string, unknown>[] = []
  const View = (props: Record<string, unknown>) => {
    calls.push(props)
    return null
  }
  return { View, calls }
}

describe('the prop filter of the React Native entry, given as shouldForwardProp', () => {
  it('keeps the props that only the styles read off a built-in component', () => {
    const { View, calls } = createView()
    const { styled } = createStyle(theme)

    const Card = styled(View, { shouldForwardProp: isPropValid })<{ elevated?: boolean }>(
      ({ elevated }) => ({ padding: 16, elevation: elevated ? 4 : 0 })
    )
    render(<Card elevated testID="card" />)
    expect(calls.map((props) => Object.keys(props).sort())).toEqual([['style', 'testID']])
  })

  it('is not the default: without it, the component gets every prop', () => {
    const { View, calls } = createView()
    const Card = createStyle(theme).styled(View)<{ elevated?: boolean }>({ padding: 16 })
    render(<Card elevated testID="card" />)
    expect(Object.keys(calls[0]).sort()).toEqual(['elevated', 'style', 'testID'])
  })
})
