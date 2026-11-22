import { act, render } from '@testing-library/react'
import { system } from '@soroush.tech/styled-system/core'
import { space, type SpaceProps } from '@soroush.tech/styled-system/space'
import shouldForwardProp from '@soroush.tech/styled-system/should-forward-prop'
import { variant } from '@soroush.tech/styled-system/variant'
import { createElement } from 'react'
import { platform } from '../vitest.react-native'
import { createStyle } from './createStyle'

// A theme written for the web: its lengths are text, and its breakpoints are what the parsers read.
const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  colors: { brand: '#d11b5f' },
  space: ['0px', '4px', '8px', '16px'],
  breakpoints: ['600px', '900px'],
}

type Props = Record<string, unknown>

/** A stand-in for a native component: it records the props it gets. */
function createStandIn() {
  const calls: Props[] = []
  const View = (props: Props) => {
    calls.push(props)
    return createElement('view')
  }
  return { View, calls }
}

afterEach(() => {
  platform.resize(400, 800)
})

describe('the parsers of @soroush.tech/styled-system on React Native', () => {
  it('space: a key of the scale is the converted number, and a negative key its negative', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Box = styled(View)<SpaceProps>(space)
    render(<Box p={2} mx={3} m={-2} />)
    expect(calls[0].style).toEqual([{ margin: -8, marginLeft: 16, marginRight: 16, padding: 8 }])
  })

  it('space: a responsive array is a media block in the range form, evaluated against the window', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Box = styled(View)<SpaceProps>(space)
    render(<Box p={[1, 2, 3]} />)
    act(() => platform.resize(700, 800))
    act(() => platform.resize(1000, 800))
    expect(calls.map((call) => call.style)).toEqual([
      [{ padding: 4 }],
      [{ padding: 8 }],
      [{ padding: 16 }],
    ])
  })

  it('system and variant: a scale of the theme gives its value, a variant its style; a parser with nothing to say is an empty entry', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const color = system({ color: { property: 'color', scale: 'palette' } })
    const kind = variant({
      prop: 'kind',
      variants: { filled: { backgroundColor: 'brand', padding: 2 } },
    })
    const Box = styled(View)<{ color?: string; kind?: 'filled' }>(color, kind)
    render(<Box color="primary" />)
    render(<Box kind="filled" />)
    expect(calls.map((call) => call.style)).toEqual([
      [{ color: '#1b5fd1' }, {}],
      [{}, { backgroundColor: '#d11b5f', padding: 8 }],
    ])
  })

  it('reaches the component with its props unless shouldForwardProp keeps them off', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Plain = styled(View)<SpaceProps>(space)
    const Filtered = styled(View, { shouldForwardProp })<SpaceProps>(space)
    render(<Plain p={1} />)
    render(<Filtered p={1} />)
    expect(calls[0].p).toBe(1)
    expect(calls[1]).not.toHaveProperty('p')
  })
})
