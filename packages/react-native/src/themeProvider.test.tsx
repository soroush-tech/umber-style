import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { bindHolder, createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const light = {
  palette: { primary: '#0000ff', text: '#111111' },
  breakpoints: Object.defineProperty({ values: { md: 768 } }, 'up', {
    value: (key: string) => `(min-width: ${key})`,
  }),
}

type Props = Record<string, unknown>

/** A stand-in for a native component: it records the props it gets. */
function createStandIn() {
  const calls: Props[] = []
  const View = (props: Props) => {
    calls.push(props)
    return createElement('view', null, props.children as ReactNode)
  }
  return { View, calls }
}

/** A stand-in for a modal: on React Native its content stays inside the React tree. */
const Modal = ({ children }: { children?: ReactNode }) => createElement('modal', null, children)

describe('the provider on React Native', () => {
  it('renders no element, and a modal under a nested provider shows the nested theme', () => {
    const { styled, ThemeProvider, ThemeScope, useThemeClass } = createStyle(light)
    const { View, calls } = createStandIn()
    const Box = styled(View)(({ theme }) => ({ color: theme.palette.primary }))
    const classes: unknown[] = []
    const Probe = () => {
      classes.push(useThemeClass())
      return <Box />
    }
    const { container } = render(
      <ThemeProvider theme={light}>
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Modal>
            <ThemeScope>
              <Probe />
            </ThemeScope>
          </Modal>
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(container.innerHTML).toBe('<modal><view></view></modal>')
    expect(calls[0].style).toEqual([{ color: '#ff0000' }])
    expect(classes).toEqual([undefined])
  })

  it('takes a function theme of the theme above, or of an empty object as the first base', () => {
    const { styled, ThemeProvider } = bindHolder<typeof light>({ baseTheme: undefined })
    const { View, calls } = createStandIn()
    const Box = styled(View)(({ theme }) => ({ color: theme.palette.primary }))
    const seen: unknown[] = []
    render(
      <ThemeProvider
        theme={(outer) => {
          seen.push(outer)
          return light
        }}
      >
        <ThemeProvider theme={(outer) => ({ palette: { primary: outer.palette.text } })}>
          <Box />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(seen).toEqual([{}])
    expect(calls[0].style).toEqual([{ color: '#111111' }])
  })

  it('gives the merged theme to ThemeContext, with the helpers of a raw key kept', () => {
    const { ThemeProvider, ThemeContext } = createStyle(light)
    const seen: (typeof light | undefined)[] = []
    render(
      <>
        <ThemeContext.Consumer>{(theme) => (seen.push(theme), null)}</ThemeContext.Consumer>
        <ThemeProvider theme={{ breakpoints: { values: { md: 600 } } }}>
          <ThemeContext.Consumer>{(theme) => (seen.push(theme), null)}</ThemeContext.Consumer>
        </ThemeProvider>
      </>
    )
    expect(seen[0]).toBeUndefined()
    const merged = seen[1] as typeof light
    expect(merged.breakpoints.values.md).toBe(600)
    expect((merged.breakpoints as unknown as { up: unknown }).up).toBe(
      (light.breakpoints as unknown as { up: unknown }).up
    )
  })

  it('has the same names in the default style', () => {
    const style = createDefaultStyle()
    const { container } = render(
      <style.ThemeScope>
        <i />
      </style.ThemeScope>
    )
    expect(container.innerHTML).toBe('<i></i>')
    let seen: unknown = 'unset'
    const Probe = () => {
      seen = style.useThemeClass()
      return null
    }
    render(<Probe />)
    expect(seen).toBeUndefined()
    expect(style.ThemeContext).toBeDefined()
  })
})
