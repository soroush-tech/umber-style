import { render } from '@testing-library/react'
import { createElement } from 'react'
import { StyleSheet as platform } from 'react-native'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const light = { palette: { primary: '#0000ff' }, space: { small: 4 } }
const other = { palette: { primary: '#ff0000' }, space: { small: 8 } }

beforeEach(() => {
  vi.mocked(platform.create).mockClear()
})

const registeredWith = () => vi.mocked(platform.create).mock.calls.map(([styles]) => styles)

describe('the platform StyleSheet', () => {
  it('registers the styles of a sheet once for each theme, with no web-only keys', () => {
    const { StyleSheet, useStyle, ThemeProvider } = createStyle(light)
    const sheet = StyleSheet.create((theme) => ({
      box: { padding: theme.space.small, '&:hover': { color: 'red' }, label: 'x' },
    }))
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      return null
    }
    const { rerender } = render(<Probe />)
    rerender(<Probe />)
    expect(registeredWith()).toEqual([{ box: { padding: 4 } }])
    expect(seen[1]).toBe(seen[0])

    render(
      <ThemeProvider theme={other}>
        <Probe />
      </ThemeProvider>
    )
    expect(registeredWith()).toEqual([{ box: { padding: 4 } }, { box: { padding: 8 } }])
  })

  it('registers the styles of an object sheet once', () => {
    const { StyleSheet, useStyle } = createStyle(light)
    const sheet = StyleSheet.create({ box: { margin: 1 } })
    const Probe = () => {
      useStyle(sheet)
      return null
    }
    const { rerender } = render(<Probe />)
    rerender(<Probe />)
    expect(registeredWith()).toEqual([{ box: { margin: 1 } }])
  })

  it('registers the object styles of a styled component when it is made, and not again', () => {
    const { styled } = createStyle(light)
    const calls: Record<string, unknown>[] = []
    const View = (props: Record<string, unknown>) => {
      calls.push(props)
      return createElement('view')
    }
    const Box = styled(View)(
      { margin: 1, '&:hover': { color: 'red' } } as never,
      null as never,
      ({ theme }) => ({
        padding: theme.space.small,
      })
    )
    expect(registeredWith()).toEqual([{ s0: { margin: 1 } }])
    const { rerender } = render(<Box />)
    rerender(<Box />)
    expect(registeredWith()).toHaveLength(1)
    expect(calls[1].style).toEqual([{ margin: 1 }, { padding: 4 }])
  })

  it('registers nothing for a component with only function styles, or no styles', () => {
    const { styled } = createStyle(light)
    const View = () => createElement('view')
    const Dynamic = styled(View)(({ theme }) => ({ padding: theme.space.small }))
    const Empty = styled(View)()
    const Nothing = styled(View)(() => false)
    render(<Dynamic />)
    render(<Empty />)
    render(<Nothing />)
    expect(registeredWith()).toEqual([])
  })

  it('keeps the other members of the platform StyleSheet', () => {
    const { StyleSheet } = createStyle(light)
    expect(StyleSheet.hairlineWidth).toBe(1)
    expect(StyleSheet.absoluteFill).toEqual({ position: 'absolute' })
    expect(StyleSheet.flatten({ a: 1 } as never)).toEqual({ a: 1 })
    expect(createDefaultStyle().StyleSheet.hairlineWidth).toBe(1)
  })
})
