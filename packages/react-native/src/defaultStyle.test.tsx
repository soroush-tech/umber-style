import { render } from '@testing-library/react'
import { NO_THEME_MESSAGE } from '@umber-style/core'
import { createElement } from 'react'
import { createDefaultStyle } from './defaultStyle'
import { createStyle } from './createStyle'

const light = { palette: { primary: '#0000ff' }, space: { small: 4 } }
const other = { palette: { primary: '#ff0000' }, space: { small: 8 } }

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

describe('the default style on React Native', () => {
  it('lets styled run before any theme and takes the base from the outermost provider', () => {
    const { styled, ThemeProvider } = createDefaultStyle()
    const { View, calls } = createStandIn()
    const Box = styled(View)(({ theme }) => ({ padding: theme.space.small }))
    render(
      <ThemeProvider theme={light}>
        <Box />
        <ThemeProvider theme={{ space: { small: 9 } }}>
          <Box />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(calls.map((call) => call.style)).toEqual([[{ padding: 4 }], [{ padding: 9 }]])
  })

  it('accepts isRoot and ignores it', () => {
    const { ThemeProvider, useTheme } = createDefaultStyle()
    const Probe = () => <i>{useTheme().palette.primary}</i>
    const { container } = render(
      <ThemeProvider theme={light} isRoot>
        <Probe />
      </ThemeProvider>
    )
    expect(container.innerHTML).toBe('<i>#0000ff</i>')
  })

  it('keeps the first root as the base: a second root merges over it', () => {
    const { ThemeProvider, useTheme } = createDefaultStyle()
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    render(
      <>
        <ThemeProvider theme={light}>
          <Probe />
        </ThemeProvider>
        <ThemeProvider theme={other}>
          <Probe />
        </ThemeProvider>
      </>
    )
    expect(seen).toEqual([light, other])
  })

  it('throws one clear error with no theme, and uses the theme of configure', () => {
    const bare = createDefaultStyle()
    const { View } = createStandIn()
    const Box = bare.styled(View)(({ theme }) => ({ padding: theme.space.small }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Box />)).toThrow(NO_THEME_MESSAGE)

    const configured = createDefaultStyle()
    configured.configure({ theme: light })
    const { View: Other, calls } = createStandIn()
    const Styled = configured.styled(Other)(({ theme }) => ({ padding: theme.space.small }))
    render(<Styled />)
    expect(calls[0].style).toEqual([{ padding: 4 }])
  })

  it('throws from configure once it was used', () => {
    const { configure, useTheme } = createDefaultStyle()
    configure({ theme: light })
    const Probe = () => <i>{useTheme().palette.primary}</i>
    render(<Probe />)
    expect(() => configure({ theme: other })).toThrow('before the default style is used')
  })

  it('has a sheet, useStyle, apply and an empty themeClass', () => {
    const { StyleSheet, useStyle, apply, themeClass, configure } = createDefaultStyle()
    configure({ theme: light })
    const sheet = StyleSheet.create((theme) => ({ box: { padding: theme.space.small } }))
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useStyle(sheet).box)
      return null
    }
    render(<Probe />)
    expect(seen[0]).toEqual({ padding: 4 })
    expect(apply({ margin: 1 }, null)).toEqual({ style: [{ margin: 1 }] })
    expect(themeClass(light, 'dark')).toBe('')
  })
})

describe('createStyle', () => {
  it('starts from the base theme it is given', () => {
    const { useTheme } = createStyle(light)
    const Probe = () => <i>{useTheme().palette.primary}</i>
    expect(render(<Probe />).container.textContent).toBe('#0000ff')
  })
})
