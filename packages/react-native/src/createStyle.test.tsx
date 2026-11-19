import { render } from '@testing-library/react'
import { createElement } from 'react'
import { alpha } from './alpha'
import { createStyle } from './createStyle'

const baseTheme = {
  palette: { primary: '#0000ff' },
  space: { small: 4 },
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

describe('styled on React Native', () => {
  it('passes a style array with real values and no web-only keys', () => {
    const { styled, ThemeProvider } = createStyle(baseTheme)
    const { View, calls } = createStandIn()
    const Box = styled(View, { name: 'Box' })(
      ({ theme }) => ({
        padding: theme.space.small,
        backgroundColor: theme.palette.primary,
        '&:hover': { color: 'red' },
      }),
      null as never,
      { margin: 2 }
    )
    render(<Box style={[{ opacity: 1 }, [{ flex: 1 }]]} tone="x" id="a" />)
    expect(calls[0].style).toEqual([
      { padding: 4, backgroundColor: '#0000ff' },
      { margin: 2 },
      { opacity: 1 },
      { flex: 1 },
    ])
    expect(calls[0].id).toBe('a')
    expect(calls[0].tone).toBe('x')
    expect(calls[0]).not.toHaveProperty('theme')

    render(
      <ThemeProvider theme={{ palette: { primary: '#ff0000' }, space: { small: 8 } }}>
        <Box />
      </ThemeProvider>
    )
    expect(calls[1].style).toEqual([{ padding: 8, backgroundColor: '#ff0000' }, { margin: 2 }])
  })

  it('renders the component of `as` and uses shouldForwardProp', () => {
    const { styled } = createStyle(baseTheme)
    const first = createStandIn()
    const second = createStandIn()
    const Box = styled(first.View, { shouldForwardProp: (prop) => prop === 'id' })({ margin: 1 })
    render(<Box as={second.View} id="a" title="b" />)
    expect(first.calls).toHaveLength(0)
    expect(second.calls[0]).toEqual({ id: 'a', style: [{ margin: 1 }] })
  })

  it('throws for a string tag when it is created', () => {
    const { styled } = createStyle(baseTheme)
    expect(() => styled('div')).toThrow(
      'styled needs a component on React Native, not the tag "div".'
    )
  })
})

describe('useStyle on React Native', () => {
  it('returns plain objects, computed once for each theme', () => {
    const { StyleSheet, useStyle, ThemeProvider } = createStyle(baseTheme)
    const make = vi.fn((theme: typeof baseTheme) => ({
      box: { padding: theme.space.small, '&:hover': { color: 'red' }, label: 'x' },
    }))
    const sheet = StyleSheet.create(make)
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      return null
    }
    const { rerender } = render(<Probe />)
    rerender(<Probe />)
    expect(make).toHaveBeenCalledTimes(1)
    expect(seen[0]).toEqual({ box: { padding: 4 } })
    expect(seen[1]).toBe(seen[0])

    render(
      <ThemeProvider theme={{ space: { small: 8 } }}>
        <Probe />
      </ThemeProvider>
    )
    expect(make).toHaveBeenCalledTimes(2)
    expect(seen[2]).toEqual({ box: { padding: 8 } })
  })

  it('takes a plain object too', () => {
    const { StyleSheet, useStyle } = createStyle(baseTheme)
    const sheet = StyleSheet.create({ box: { margin: 1 } })
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      return null
    }
    render(<Probe />)
    expect(seen[0]).toEqual({ box: { margin: 1 } })
  })

  it('apply returns a style array without the empty entries', () => {
    const { apply } = createStyle(baseTheme)
    expect(apply({ a: 1 }, null, undefined, false, { b: 2 })).toEqual({
      style: [{ a: 1 }, { b: 2 }],
    })
  })
})

describe('the theme on React Native', () => {
  it('useTheme returns the base theme without a provider and the merged theme inside one', () => {
    const { useTheme, ThemeProvider, themeClass } = createStyle(baseTheme, { prefix: 'ignored' })
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    render(
      <>
        <Probe />
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }} colorScheme="dark" className="x">
          <Probe />
        </ThemeProvider>
      </>
    )
    expect(seen[0]).toBe(baseTheme)
    expect(seen[1]).toEqual({ palette: { primary: '#ff0000' }, space: { small: 4 } })
    expect(themeClass({}, 'dark')).toBe('')
  })

  it('alpha is the native one', () => {
    expect(alpha('#000', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })
})
