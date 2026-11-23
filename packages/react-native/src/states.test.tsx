import { act, render } from '@testing-library/react'
import { createElement, useState } from 'react'
import { Pressable } from 'react-native'
import { at, state } from '@umber-style/core'
import { platform } from '../vitest.react-native'
import { matchesCondition } from './conditions'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import { collectKeys, toNativeStyle } from './toNativeStyle'
import { warnAboutDroppedKey } from './warnStyle'

const theme = { palette: { primary: '#0000ff' } }
const dark = { palette: { primary: '#8888ff' } }
const settings = { remBase: 16 }
const wide: string = '@media (min-width: 600px)'
// A selector key is typed as a string, as in a style written for both platforms.
const active: string = '&:active'

type Props = Record<string, unknown>

/** A stand-in for a native component that reports no state: it records the props it gets. */
function createStandIn() {
  const calls: Props[] = []
  const View = (props: Props) => {
    calls.push(props)
    return createElement('view')
  }
  return { View, calls }
}

const press = (testID: string, isDown = true) =>
  act(() => {
    const record = platform.pressable(testID)
    if (isDown) record.pressIn()
    else record.pressOut()
  })

afterEach(() => {
  platform.forgetPressables()
  platform.resize(400, 800)
  vi.restoreAllMocks()
})

describe('toNativeStyle with state keys', () => {
  it('merges the parts of the states that hold over the rest, in the order they are written', () => {
    const style = {
      opacity: 1,
      ...at(state('pressed'), { opacity: 0.7 }),
      ...at(state('disabled'), { opacity: 0.4 }),
    }
    expect(toNativeStyle(style)).toEqual({ opacity: 1 })
    expect(toNativeStyle(style, undefined, settings, undefined, {})).toEqual({ opacity: 1 })
    expect(toNativeStyle(style, undefined, settings, undefined, { pressed: true })).toEqual({
      opacity: 0.7,
    })
    expect(
      toNativeStyle(style, undefined, settings, undefined, { pressed: true, disabled: true })
    ).toEqual({ opacity: 0.4 })
  })

  it('takes a state inside a condition and a media key, and the reverse', () => {
    const { when } = createStyle(theme)
    const style = {
      [when(dark)]: { ...at(state('pressed'), { opacity: 0.5 }) },
      ...at(state('focused'), { [wide]: { margin: 2 }, '@scheme dark': { padding: 3 } }),
    }
    const condition = { theme: dark, colorScheme: 'dark' as const }
    const window = {
      width: 700,
      height: 800,
      colorScheme: 'light' as const,
      isReducedMotion: false,
    }
    expect(toNativeStyle(style, condition, settings, window, { pressed: true })).toEqual({
      opacity: 0.5,
    })
    expect(toNativeStyle(style, condition, settings, window, { focused: true })).toEqual({
      margin: 2,
      padding: 3,
    })
    expect(toNativeStyle(style, undefined, settings, undefined, { pressed: true })).toEqual({})
  })

  it('tells the states of a style, each once, in its native part and inside other parts', () => {
    const style = {
      ...at(state('pressed'), { ...at(state('hovered'), {}) }),
      native: { '@scheme dark': { ...at(state('pressed'), {}) } },
      '&:active': { ...at(state('disabled'), {}) },
    }
    expect(collectKeys(style)).toEqual({
      isConditional: true,
      hasScheme: true,
      queries: [],
      states: ['pressed', 'hovered'],
    })
    expect(collectKeys({ [state('nope' as never)]: { opacity: 1 } })).toBeUndefined()
  })

  it('matches a state key against what the component is doing, and nothing else', () => {
    expect(matchesCondition(state('pressed'), undefined, { pressed: true })).toBe(true)
    expect(matchesCondition(state('pressed'), undefined, { hovered: true })).toBe(false)
    expect(matchesCondition(state('pressed'), undefined)).toBe(false)
    expect(matchesCondition('@scheme dark', { theme, colorScheme: 'dark' }, {})).toBe(true)
  })

  it('drops a state key without a warning, and still warns about a selector key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutDroppedKey(state('pressed'), 'StateButton')
    expect(warn).not.toHaveBeenCalled()
    warnAboutDroppedKey('&:active', 'StateButton')
    expect(warn.mock.calls[0][0]).toBe(
      '@umber-style/react-native: StateButton: "&:active" is dropped: React Native has no selectors. A key for the web only goes in the web part of a shared style.'
    )
    warnAboutDroppedKey('@state nope', 'StateButton')
    expect(warn.mock.calls[1][0]).toContain(
      '"@state nope" is dropped: React Native has no at-rules'
    )
  })
})

describe('pressed on a Pressable', () => {
  it('gives a function style that the platform calls with { pressed }, so that a press renders it again', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)({
      opacity: 1,
      ...at(state('pressed'), { opacity: 0.7 }),
      ...at(state('disabled'), { opacity: 0.4 }),
    })
    render(<Button testID="pressed" />)
    const record = platform.pressable('pressed')
    expect(typeof record.props.style).toBe('function')
    expect(record.style).toEqual([{ opacity: 1 }])
    expect(record.renders).toBe(1)
    press('pressed')
    expect(record.style).toEqual([{ opacity: 0.7 }])
    expect(record.renders).toBe(2)
    press('pressed', false)
    expect(record.style).toEqual([{ opacity: 1 }])
    expect(record.renders).toBe(3)
  })

  it('keeps an array for a pressable whose styles name no state, which a press does not render again', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)({ opacity: 1, [active]: { opacity: 0.7 } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Button testID="plain" />)
    const record = platform.pressable('plain')
    expect(record.props.style).toEqual([{ opacity: 1 }])
    press('plain')
    press('plain', false)
    expect(record.renders).toBe(1)
    expect(record.style).toEqual([{ opacity: 1 }])
  })

  it('keeps an array for a pressable that names disabled only: the props decide it, not a press', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)({ opacity: 1, ...at(state('disabled'), { opacity: 0.4 }) })
    render(<Button testID="off" disabled />)
    const record = platform.pressable('off')
    expect(record.props.style).toEqual([{ opacity: 0.4 }])
    expect(record.props.disabled).toBe(true)
    press('off')
    expect(record.renders).toBe(1)
  })

  it('is not pressed while it is disabled', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)({
      opacity: 1,
      ...at(state('pressed'), { opacity: 0.7 }),
      ...at(state('disabled'), { opacity: 0.4 }),
    })
    render(<Button testID="disabled-press" disabled />)
    press('disabled-press')
    expect(platform.pressable('disabled-press').style).toEqual([{ opacity: 0.4 }])
  })

  it('calls a style prop that is a function with the same { pressed }, and puts its result last', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)({ opacity: 1, ...at(state('pressed'), { opacity: 0.7 }) })
    const own = vi.fn(({ pressed }: { pressed: boolean }) => ({ margin: pressed ? 2 : 1 }))
    render(<Button testID="own" style={own as never} />)
    expect(platform.pressable('own').style).toEqual([{ opacity: 1 }, { margin: 1 }])
    press('own')
    expect(platform.pressable('own').style).toEqual([{ opacity: 0.7 }, { margin: 2 }])
    expect(own).toHaveBeenLastCalledWith({ pressed: true })
  })

  it('gives a function to a Pressable that names disabled only when its style prop is a function', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)({ opacity: 1, ...at(state('disabled'), { opacity: 0.4 }) })
    const own = ({ pressed }: { pressed: boolean }) => (pressed ? { margin: 2 } : null)
    render(<Button testID="own-disabled" style={own as never} />)
    expect(typeof platform.pressable('own-disabled').props.style).toBe('function')
    press('own-disabled')
    expect(platform.pressable('own-disabled').style).toEqual([{ opacity: 1 }, { margin: 2 }])
  })

  it('gives the function when Pressable is the component of `as`', () => {
    const { styled } = createStyle(theme)
    const { View } = createStandIn()
    const Button = styled(View)({ opacity: 1, ...at(state('pressed'), { opacity: 0.7 }) })
    render(<Button as={Pressable} testID="as" />)
    press('as')
    expect(platform.pressable('as').style).toEqual([{ opacity: 0.7 }])
  })

  it('applies the pressed prop too, pressed or not by the platform', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)({ opacity: 1, ...at(state('pressed'), { opacity: 0.7 }) })
    render(<Button testID="told" pressed />)
    expect(platform.pressable('told').style).toEqual([{ opacity: 0.7 }])
    expect(platform.pressable('told').props.pressed).toBeUndefined()
  })
})

describe('a component that reports no state', () => {
  it('never gets a function: it follows the props of the states, which are not forwarded', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Card = styled(View)({
      opacity: 1,
      ...at(state('pressed'), { opacity: 0.7 }),
      ...at(state('focused'), { borderWidth: 2 }),
    })
    render(
      <>
        <Card />
        <Card pressed />
        <Card pressed={false} focused />
      </>
    )
    expect(calls.map((call) => call.style)).toEqual([
      [{ opacity: 1 }],
      [{ opacity: 0.7 }],
      [{ opacity: 1, borderWidth: 2 }],
    ])
    for (const call of calls) {
      expect(call).not.toHaveProperty('pressed')
      expect(call).not.toHaveProperty('focused')
    }
  })

  it('forwards a state prop that shouldForwardProp asks for', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Card = styled(View, { shouldForwardProp: (prop) => prop === 'pressed' })({
      ...at(state('pressed'), { opacity: 0.7 }),
      ...at(state('hovered'), { opacity: 0.8 }),
    })
    render(<Card pressed hovered />)
    expect(calls[0]).toEqual({
      pressed: true,
      style: [{ opacity: 0.8 }],
      onHoverIn: expect.any(Function),
      onHoverOut: expect.any(Function),
    })
  })

  it('forwards the state props, as before, for a component whose styles name no state', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Card = styled(View)({ opacity: 1 })
    render(<Card pressed hovered focused />)
    expect(calls[0]).toEqual({
      pressed: true,
      hovered: true,
      focused: true,
      style: [{ opacity: 1 }],
    })
  })

  it('reads disabled from disabled, aria-disabled, accessibilityState and editable={false}', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Field = styled(View)({ opacity: 1, ...at(state('disabled'), { opacity: 0.4 }) })
    render(
      <>
        <Field />
        <Field disabled />
        <Field aria-disabled />
        <Field accessibilityState={{ disabled: true }} />
        <Field editable={false} />
        <Field editable disabled={false} />
      </>
    )
    expect(calls.map((call) => call.style)).toEqual([
      [{ opacity: 1 }],
      [{ opacity: 0.4 }],
      [{ opacity: 0.4 }],
      [{ opacity: 0.4 }],
      [{ opacity: 0.4 }],
      [{ opacity: 1 }],
    ])
    expect(calls[1].disabled).toBe(true)
  })
})

describe('hovered and focused', () => {
  it('are kept from the events of a component whose object styles name them, and call its own handlers', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)({
      opacity: 1,
      ...at(state('hovered'), { opacity: 0.9 }),
      ...at(state('focused'), { borderWidth: 2 }),
    })
    const onFocus = vi.fn()
    const onHoverOut = vi.fn()
    render(<Button testID="held" onFocus={onFocus} onHoverOut={onHoverOut} />)
    const record = platform.pressable('held')
    // Neither names pressed, so the style stays a list.
    expect(record.style).toEqual([{ opacity: 1 }])
    act(() => record.hoverIn())
    expect(record.style).toEqual([{ opacity: 0.9 }])
    act(() => record.focus())
    expect(record.style).toEqual([{ opacity: 0.9, borderWidth: 2 }])
    expect(onFocus).toHaveBeenCalledTimes(1)
    act(() => record.hoverOut())
    act(() => record.blur())
    expect(record.style).toEqual([{ opacity: 1 }])
    expect(onHoverOut).toHaveBeenCalledTimes(1)
    const renders = record.renders
    act(() => record.blur())
    expect(record.renders).toBe(renders)
  })

  it('adds only the handlers of the states it names', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Field = styled(View)({ ...at(state('focused'), { borderWidth: 2 }) })
    render(<Field />)
    expect(Object.keys(calls[0]).sort()).toEqual(['onBlur', 'onFocus', 'style'])
  })

  it('keeps no state and adds no handler for a component that does not name them', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const onFocus = vi.fn()
    const shapes = [
      styled(View)({ opacity: 1 }),
      styled(View)({ opacity: 1, ...at(state('pressed'), { opacity: 0.7 }) }),
      styled(View)(() => ({ opacity: 1 })),
      styled(View)({ opacity: 1, ...at(state('focused'), {}) }),
    ]
    expect(shapes.map((shape) => shape.name)).toEqual([
      'StaticStyled',
      'ConditionalStyled',
      'DynamicStyled',
      'HeldStyled',
    ])
    const [Plain, Pressed] = shapes
    render(
      <>
        <Plain onFocus={onFocus} />
        <Pressed onFocus={onFocus} />
      </>
    )
    expect(calls[0].onFocus).toBe(onFocus)
    expect(calls[1].onFocus).toBe(onFocus)
    expect(calls[1]).not.toHaveProperty('onHoverIn')
  })

  it('follows the prop alone, with a warning, when only a function style names one', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const Card = styled(View, { name: 'FocusCard' })(() => ({
      opacity: 1,
      ...at(state('focused'), { opacity: 0.5 }),
    }))
    render(
      <>
        <Card />
        <Card focused />
      </>
    )
    expect(calls.map((call) => call.style)).toEqual([[{ opacity: 1 }], [{ opacity: 0.5 }]])
    expect(calls[0]).not.toHaveProperty('onFocus')
    expect(warn.mock.calls[0][0]).toBe(
      "@umber-style/react-native: FocusCard: state('focused') is named in a function style only, so the component keeps no focused state and follows the focused prop alone. Name it in an object style of the component as well (an empty part is enough) for the binding to follow onFocus and onBlur."
    )
  })

  it('learns them for a function style when an object style names them, even empty', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)(
      ({ theme: current }) => ({
        backgroundColor: current.palette.primary,
        ...at(state('hovered'), { opacity: 0.9 }),
      }),
      { ...at(state('hovered'), {}) }
    )
    render(<Button testID="held-function" />)
    const record = platform.pressable('held-function')
    act(() => record.hoverIn())
    expect(record.style).toEqual([{ backgroundColor: '#0000ff', opacity: 0.9 }, {}])
  })
})

describe('a function style that names a state on one render and not on the next', () => {
  it('keeps the same hooks, and gives a function only while the state is named', () => {
    const { styled } = createStyle(theme)
    const Button = styled(Pressable)<{ isLive: boolean }>(({ isLive }) => ({
      opacity: 1,
      ...(isLive ? at(state('pressed'), { opacity: 0.7 }) : {}),
    }))
    let setLive: (value: boolean) => void = () => {}
    const Screen = () => {
      const [isLive, set] = useState(true)
      setLive = set
      return <Button testID="toggle" isLive={isLive} />
    }
    const error = vi.spyOn(console, 'error')
    render(<Screen />)
    const record = platform.pressable('toggle')
    expect(typeof record.props.style).toBe('function')
    press('toggle')
    expect(record.style).toEqual([{ opacity: 0.7 }])
    act(() => setLive(false))
    expect(record.props.style).toEqual([{ opacity: 1 }])
    act(() => setLive(true))
    expect(typeof record.props.style).toBe('function')
    expect(error).not.toHaveBeenCalled()
  })
})

describe('a style with state and condition keys over many renders', () => {
  it('gives each render the values that resolving it gives, the same object for the same combination', () => {
    const { styled, ThemeProvider, when } = createStyle(theme)
    const { View, calls } = createStandIn()
    const look = {
      opacity: 1,
      [when(dark)]: { opacity: 0.9, ...at(state('pressed'), { opacity: 0.2 }) },
      ...at(state('disabled'), { opacity: 0.4, [wide]: { margin: 4 } }),
      ...at(state('pressed'), { opacity: 0.7 }),
    }
    const Card = styled(View)(look)
    const renders: [object, Props][] = [
      [theme, {}],
      [theme, { disabled: true }],
      [dark, { disabled: true }],
      [dark, {}],
      [theme, { disabled: true }],
      [theme, { pressed: true }],
      [dark, { disabled: true }],
      [theme, {}],
    ]
    const { rerender } = render(<ThemeProvider theme={theme}>{null}</ThemeProvider>)
    for (const [given, props] of renders) {
      rerender(
        <ThemeProvider theme={given}>
          <Card {...props} />
        </ThemeProvider>
      )
    }
    platform.resize(700, 800)
    rerender(
      <ThemeProvider theme={theme}>
        <Card disabled />
      </ThemeProvider>
    )
    const styles = calls.map((call) => (call.style as object[])[0])
    expect(styles).toEqual([
      { opacity: 1 },
      { opacity: 0.4 },
      { opacity: 0.4 },
      { opacity: 0.9 },
      { opacity: 0.4 },
      { opacity: 0.7 },
      { opacity: 0.4 },
      { opacity: 1 },
      { opacity: 0.4, margin: 4 },
    ])
    // Each is what resolving the style for that render gives, and a combination seen before is its object.
    const window = {
      width: 400,
      height: 800,
      colorScheme: 'light' as const,
      isReducedMotion: false,
    }
    renders.forEach(([given, props], index) => {
      const condition = { theme: given, colorScheme: undefined }
      expect(styles[index]).toEqual(toNativeStyle(look, condition, settings, window, props))
    })
    expect(styles[4]).toBe(styles[1])
    expect(styles[6]).toBe(styles[2])
    expect(styles[7]).toBe(styles[0])
    expect(styles[8]).not.toBe(styles[1])
  })
})

describe('a style with state keys and no theme at all', () => {
  it('is resolved for each set of states, as with a theme', () => {
    const { styled } = createDefaultStyle()
    const { View, calls } = createStandIn()
    const Card = styled(View)({ opacity: 1, ...at(state('disabled'), { opacity: 0.4 }) })
    const { rerender } = render(<Card />)
    rerender(<Card disabled />)
    rerender(<Card />)
    const styles = calls.map((call) => (call.style as object[])[0])
    expect(styles).toEqual([{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }])
    expect(styles[2]).toBe(styles[0])
  })
})

describe('a component with no state key', () => {
  it('keeps its shape and its registered entries, the same objects on every render', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Card = styled(View)({ opacity: 1 }, { margin: 2 })
    const { rerender } = render(<Card />)
    rerender(<Card />)
    expect(Card.name).toBe('StaticStyled')
    expect(calls[1].style).toEqual([{ opacity: 1 }, { margin: 2 }])
    expect((calls[1].style as object[])[0]).toBe((calls[0].style as object[])[0])
    expect((calls[1].style as object[])[1]).toBe((calls[0].style as object[])[1])
  })
})

describe('a state key in a sheet entry', () => {
  it('never applies: an entry belongs to no component', () => {
    const { StyleSheet } = createStyle(theme)
    const sheet = StyleSheet.create({
      button: { opacity: 1, ...at(state('pressed'), { opacity: 0.7 }) },
    })
    expect(sheet.button).toEqual({ opacity: 1 })
  })
})
