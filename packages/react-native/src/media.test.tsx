import { act, render } from '@testing-library/react'
import { createElement } from 'react'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { platform } from '../vitest.react-native'
import { createStyle } from './createStyle'
import type { WindowState } from './mediaQuery'
import { collectKeys, toNativeStyle } from './toNativeStyle'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }
const dark = { palette: { primary: '#8888ff' }, space: [0, 2, 4] }

// A key is typed as a string, as a key computed from a breakpoint is: the native style type has no
// literal at-rule key.
const wide: string = '@media (min-width: 600px)'
const wideRange: string = '@media (width >= 600px)'
const portrait: string = '@media (orientation: portrait)'
const darkSystem: string = '@media (prefers-color-scheme: dark)'
const reduced: string = '@media (prefers-reduced-motion: reduce)'
const settings = { remBase: 16 }

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

/** The window, as the platform stand-in has it: 400 by 800 unless a test resized it. */
const at = (width: number, height = 800): WindowState => ({
  width,
  height,
  colorScheme: 'light',
  isReducedMotion: false,
})

const resize = (width: number, height = 800) => act(() => platform.resize(width, height))
const createCalls = () => vi.mocked(StyleSheet.create).mock.calls.length

afterEach(() => {
  platform.resize(400, 800)
  platform.setColorScheme('light')
})

describe('the order of the media blocks', () => {
  it('merges the matching blocks over every plain key, as the web writes them after the base rule, in the order they are written', () => {
    const style = {
      padding: 1,
      [wide]: { padding: 2, margin: 2 },
      margin: 1,
      '@media (min-width: 500px)': { margin: 3, opacity: 0.5 },
      opacity: 1,
    }
    expect(toNativeStyle(style, undefined, settings, at(400))).toEqual({
      padding: 1,
      margin: 1,
      opacity: 1,
    })
    expect(toNativeStyle(style, undefined, settings, at(550))).toEqual({
      padding: 1,
      margin: 3,
      opacity: 0.5,
    })
    // The later block wins over the earlier one; the plain margin written after both does not.
    expect(toNativeStyle(style, undefined, settings, at(700))).toEqual({
      padding: 2,
      margin: 3,
      opacity: 0.5,
    })
  })

  it('takes media and condition blocks in the order they are written', () => {
    const condition = { theme: undefined, colorScheme: 'dark' as const }
    const first = { [wide]: { opacity: 0.5 }, '@scheme dark': { opacity: 0.2 } }
    const second = { '@scheme dark': { opacity: 0.2 }, [wide]: { opacity: 0.5 } }
    expect(toNativeStyle(first, condition, settings, at(700))).toEqual({ opacity: 0.2 })
    expect(toNativeStyle(second, condition, settings, at(700))).toEqual({ opacity: 0.5 })
  })

  it('evaluates a block in the native part and one inside another, and converts the values in them', () => {
    const style = {
      padding: 1,
      web: { [wide]: { padding: 99 } },
      native: { [wide]: { padding: '8px', [portrait]: { margin: '1rem' } } },
    }
    expect(toNativeStyle(style, undefined, settings, at(700))).toEqual({ padding: 8, margin: 16 })
    expect(toNativeStyle(style, undefined, settings, at(700, 600))).toEqual({ padding: 8 })
    expect(toNativeStyle(style, undefined, settings, at(400))).toEqual({ padding: 1 })
  })

  it('finds each query once, in the native part and in the condition and media parts, and not under a selector', () => {
    const style = {
      padding: 1,
      [wide]: { [portrait]: { margin: 1 } },
      native: { [wide]: { '@scheme dark': { margin: 2 } } },
      '&:hover': { [darkSystem]: { margin: 3 } },
    }
    expect(collectKeys(style)).toEqual({
      isConditional: true,
      hasScheme: true,
      queries: [wide, portrait],
    })
    expect(collectKeys({ [darkSystem]: { padding: 1 } })).toEqual({
      isConditional: false,
      hasScheme: false,
      queries: [darkSystem],
    })
  })

  it('drops every block when there is no window to match against, and a block that is not an object', () => {
    expect(toNativeStyle({ padding: 1, [wide]: { padding: 2 } })).toEqual({ padding: 1 })
    expect(toNativeStyle({ padding: 1, [wide]: false }, undefined, settings, at(700))).toEqual({
      padding: 1,
    })
  })
})

describe('styled with media keys', () => {
  it('applies a block above the width and not below it, in the min-width and the range forms', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Min = styled(View)({ padding: 4, [wide]: { padding: 16 } })
    const Range = styled(View)({ padding: 4, [wideRange]: { padding: 16 } })
    render(
      <>
        <Min />
        <Range />
      </>
    )
    resize(600)
    resize(599)
    expect(calls.map((call) => call.style)).toEqual([
      [{ padding: 4 }],
      [{ padding: 4 }],
      [{ padding: 16 }],
      [{ padding: 16 }],
      [{ padding: 4 }],
      [{ padding: 4 }],
    ])
  })

  it('renders again when a breakpoint is crossed, and not when the width changes inside a range', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Card = styled(View)({ padding: 4, [wide]: { padding: 16 } })
    render(<Card />)
    resize(450)
    resize(599)
    expect(calls).toHaveLength(1)
    resize(600)
    resize(900)
    resize(1200, 400)
    expect(calls).toHaveLength(2)
    resize(300)
    expect(calls).toHaveLength(3)
    expect(calls.map((call) => call.style)).toEqual([
      [{ padding: 4 }],
      [{ padding: 16 }],
      [{ padding: 4 }],
    ])
  })

  it('registers the style once for each set of matching queries, and reuses it', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Card = styled(View)({ margin: 1 }, { padding: 4, [wide]: { padding: 16 } })
    const before = createCalls()
    render(<Card />)
    resize(700)
    resize(300)
    resize(800)
    // The fixed style when the component was made, then one for each set: narrow, then wide.
    expect(createCalls() - before).toBe(2)
    expect((calls[2].style as object[])[1]).toBe((calls[0].style as object[])[1])
    expect((calls[3].style as object[])[1]).toBe((calls[1].style as object[])[1])
    expect((calls[2].style as object[])[0]).toBe((calls[1].style as object[])[0])
  })

  it('subscribes to nothing for a component without media keys, and to the platform once for all the others', () => {
    const { styled, when, whenScheme, ThemeProvider } = createStyle(theme)
    const { View } = createStandIn()
    const Plain = styled(View)({ padding: 1 })
    const Themed = styled(View)(({ theme: view }) => ({ padding: view.space[1] }))
    const Conditional = styled(View)({ [when(dark)]: { padding: 2 } })
    const Card = styled(View)({ [wide]: { padding: 2 } })
    const plain = render(
      <ThemeProvider theme={theme} colorScheme="dark">
        <Plain />
        <Themed />
        <Conditional />
        <Card />
        <Card />
      </ThemeProvider>
    )
    expect(platform.countListeners()).toBe(3)
    plain.unmount()
    expect(platform.countListeners()).toBe(0)
    const scheme = styled(View)({ [whenScheme('dark')]: { padding: 2 } })
    render(
      <ThemeProvider theme={theme} colorScheme="light">
        <Plain />
        <Themed />
        <Conditional />
        {createElement(scheme)}
      </ThemeProvider>
    )
    expect(platform.countListeners()).toBe(0)
  })

  it('evaluates the media keys of a function style, against the window of each render', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Card = styled(View)<{ isDense?: boolean }>(
      ({ theme: view }) => ({ padding: view.space[1], [wide]: { padding: view.space[2] } }),
      ({ isDense }) => isDense && { [portrait]: { margin: 1 } }
    )
    render(<Card />)
    resize(700)
    resize(800)
    resize(500)
    expect(calls.map((call) => call.style)).toEqual([
      [{ padding: 4 }],
      [{ padding: 8 }],
      [{ padding: 4 }],
    ])
    calls.length = 0
    render(<Card isDense />)
    resize(500, 400)
    expect(calls.map((call) => call.style)).toEqual([
      [{ padding: 4 }, { margin: 1 }],
      [{ padding: 4 }, {}],
    ])
  })

  it('evaluates the media keys of a conditional style and of its native part', () => {
    const { styled, when, ThemeProvider } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Card = styled(View)(
      { padding: 4, [wide]: { padding: 8 } },
      // A shared style, whose native part the native style type does not declare.
      { [when(dark)]: { opacity: 0.5 }, native: { [wide]: { margin: 2 } } } as never
    )
    render(
      <ThemeProvider theme={dark}>
        <Card />
      </ThemeProvider>
    )
    resize(700)
    expect(calls.map((call) => call.style)).toEqual([
      [{ padding: 4 }, { opacity: 0.5 }],
      [{ padding: 8 }, { opacity: 0.5, margin: 2 }],
    ])
  })

  it('follows the system color scheme for prefers-color-scheme, and for whenScheme() where no provider has a scheme', () => {
    const { styled, whenScheme, ThemeProvider } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Scheme = styled(View)({
      opacity: 1,
      [whenScheme('dark')]: { opacity: 0.5 },
      [whenScheme('light')]: { margin: 1 },
    })
    const Media = styled(View)({
      margin: 1,
      [darkSystem]: { margin: 2 },
    })
    const Themed = styled(View)(({ theme: view }) => ({
      padding: view.space[1],
      [whenScheme('dark')]: { padding: view.space[2] },
    }))
    render(
      <>
        <Scheme />
        <Media />
        <Themed />
        <ThemeProvider theme={theme} colorScheme="light">
          <Scheme />
          <Media />
          <Themed />
        </ThemeProvider>
      </>
    )
    expect(calls).toHaveLength(6)
    act(() => platform.setColorScheme('dark'))
    // The provider decides whenScheme() below it, so those components do not render again; the media
    // query follows the system, under the provider too, as on the web.
    expect(calls.slice(6).map((call) => call.style)).toEqual([
      [{ opacity: 0.5 }],
      [{ margin: 2 }],
      [{ padding: 8 }],
      [{ margin: 2 }],
    ])
  })

  it('reads reduced motion as no preference until the platform answers, then follows its changes', async () => {
    let answer: (value: boolean) => void = () => {}
    vi.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      })
    )
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Motion = styled(View)({ opacity: 1, [reduced]: { opacity: 0 } })
    render(<Motion />)
    expect(calls.map((call) => call.style)).toEqual([[{ opacity: 1 }]])
    await act(async () => answer(true))
    act(() => platform.setReducedMotion(true))
    act(() => platform.setReducedMotion(false))
    expect(calls.map((call) => call.style)).toEqual([
      [{ opacity: 1 }],
      [{ opacity: 0 }],
      [{ opacity: 1 }],
    ])
  })
})

describe('a sheet with media keys', () => {
  it('resolves the entries for the window, once for each theme and each set of matching queries', () => {
    const { StyleSheet: Sheet, useStyle, ThemeProvider } = createStyle(theme)
    const make = vi.fn((view: typeof theme) => ({
      row: { flexDirection: 'column' as const, [wide]: { flexDirection: 'row' as const } },
      plain: { margin: view.space[1] },
    }))
    const sheet = Sheet.create(make)
    const seen: object[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      return null
    }
    render(
      <ThemeProvider theme={theme}>
        <Probe />
      </ThemeProvider>
    )
    const before = createCalls()
    resize(500)
    resize(700)
    resize(900)
    resize(300)
    expect(seen).toEqual([
      { row: { flexDirection: 'column' }, plain: { margin: 4 } },
      { row: { flexDirection: 'row' }, plain: { margin: 4 } },
      { row: { flexDirection: 'column' }, plain: { margin: 4 } },
    ])
    expect(seen[2]).toBe(seen[0])
    expect(make).toHaveBeenCalledTimes(1)
    expect(createCalls() - before).toBe(1)
  })

  it('evaluates the media keys of an entry that has a condition key too', () => {
    const { StyleSheet: Sheet, useStyle, when, ThemeProvider } = createStyle(theme)
    const sheet = Sheet.create(() => ({
      card: { padding: 1, [when(dark)]: { [wide]: { padding: 2 } } },
      plain: { margin: 1 },
    }))
    const seen: object[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      return null
    }
    render(
      <ThemeProvider theme={dark}>
        <Probe />
      </ThemeProvider>
    )
    resize(700)
    expect(seen).toEqual([
      { card: { padding: 1 }, plain: { margin: 1 } },
      { card: { padding: 2 }, plain: { margin: 1 } },
    ])
  })

  it('resolves for the window now outside a component, and drops the blocks of an object sheet', () => {
    const { StyleSheet: Sheet, useStyle } = createStyle(theme)
    const sheet = Sheet.create(() => ({ row: { margin: 1, [wide]: { margin: 2 } } }))
    platform.resize(700, 800)
    expect((sheet as unknown as { resolve(view: object): object }).resolve(theme)).toEqual({
      row: { margin: 2 },
    })
    const fixed = Sheet.create({ row: { margin: 1, [wide]: { margin: 2 } } })
    expect(fixed.row).toEqual({ margin: 1 })
    let entries: object | undefined
    const Probe = () => {
      entries = useStyle(fixed)
      return null
    }
    render(<Probe />)
    expect(entries).toBe(fixed)
    expect(platform.countListeners()).toBe(0)
  })
})
