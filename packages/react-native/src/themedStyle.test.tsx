import { act, render } from '@testing-library/react'
import { createElement, useState, type ReactNode } from 'react'
import {
  StyleSheet as platformSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { ThemedEntry } from '@umber-style/core'
import { platform } from '../vitest.react-native'
import { createStyle } from './createStyle'
import type { NativeSheetEntry } from './nativeStyle'
import type { SheetStyleProp, StyleProp } from './types'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }
const dark = { palette: { primary: '#8888ff' }, space: [0, 2, 4] }

// A key is typed as a string, as a key computed from a breakpoint is.
const wide: string = '@media (min-width: 600px)'

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

const resize = (width: number, height = 800) => act(() => platform.resize(width, height))

afterEach(() => {
  platform.resize(400, 800)
  platform.setColorScheme('light')
})

/** A sheet with a media key, a `when()` key and a `whenScheme()` key. */
function setup() {
  const style = createStyle(theme)
  const sheet = style.StyleSheet.create((view) => ({
    card: { padding: view.space[1], [wide]: { padding: view.space[2] } },
    tone: { [style.when(dark)]: { opacity: 0.5 }, [style.whenScheme('dark')]: { margin: 3 } },
  }))
  return { ...style, sheet }
}

describe('a handle in the style of a styled component on React Native', () => {
  it('is the entry useStyle gives, on a static component, and follows a rotation of the window', () => {
    const { styled, sheet, useStyle } = setup()
    const { View, calls } = createStandIn()
    const Card = styled(View)()
    const hook: unknown[] = []
    const Probe = () => {
      hook.push(useStyle(sheet).card)
      return <Card style={sheet.card} />
    }
    render(<Probe />)
    expect(calls.at(-1)?.style).toEqual([{ padding: 4 }])
    expect(calls.at(-1)?.style).toEqual([hook.at(-1)])
    resize(800, 400)
    expect(calls.at(-1)?.style).toEqual([{ padding: 8 }])
    resize(400, 800)
    expect(calls.at(-1)?.style).toEqual([{ padding: 4 }])
  })

  it('resolves handles in lists, against the nearest provider and the system color scheme', () => {
    const { styled, sheet, ThemeProvider } = setup()
    const { View, calls } = createStandIn()
    const Card = styled(View)({ borderWidth: 1 })
    render(
      <ThemeProvider theme={dark}>
        <Card style={[sheet.card, [false, sheet.tone], null, { flex: 1 }]} />
      </ThemeProvider>
    )
    expect(calls.at(-1)?.style).toEqual([
      { borderWidth: 1 },
      { padding: 2 },
      { opacity: 0.5 },
      { flex: 1 },
    ])
    act(() => platform.setColorScheme('dark'))
    expect(calls.at(-1)?.style).toEqual([
      { borderWidth: 1 },
      { padding: 2 },
      { opacity: 0.5, margin: 3 },
      { flex: 1 },
    ])
  })

  it('keeps the hooks of a component in order when its style switches between a handle and none', () => {
    const { styled, sheet } = setup()
    const { View, calls } = createStandIn()
    const Card = styled(View)({ [wide]: { margin: 1 } })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let flip: () => void = () => undefined
    const Toggle = () => {
      const [isOn, setOn] = useState(false)
      flip = () => setOn((value) => !value)
      return <Card style={isOn ? sheet.card : undefined} />
    }
    render(<Toggle />)
    act(() => flip())
    expect(calls.at(-1)?.style).toEqual([{}, { padding: 4 }])
    act(() => flip())
    expect(calls.at(-1)?.style).toEqual([{}])
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('throws for a name the sheet does not have', () => {
    const { styled, sheet } = setup()
    const { View } = createStandIn()
    const Card = styled(View)()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const missing = (sheet as unknown as Record<string, ThemedEntry>).missing
    expect(() => render(<Card style={missing} />)).toThrow(
      'The sheet has no style named "missing".'
    )
    errors.mockRestore()
  })

  it('is a TypeError where no theme is known: apply, css(), the styles of styled, a plain View, a serializer', () => {
    const { sheet, apply, css, styled } = setup()
    const { View } = createStandIn()
    expect(() => apply(sheet.card as never)).toThrow(/^apply\(\): an entry of a sheet/)
    expect(() => css(sheet.card as never)).toThrow(/^css\(\): /)
    expect(() => styled(View)(sheet.card as never)).toThrow(/^styled\(\): /)
    expect(() => ({ ...sheet.card })).toThrow(/^A plain element: /)
    expect(() => JSON.stringify(sheet.card)).toThrow(/^A plain element: /)
  })
})

describe('the slot pattern on React Native', () => {
  it('gives each part its entry, from handles and from entries', () => {
    const { styled, sheet, useStyle } = setup()
    const { View, calls } = createStandIn()
    const Root = styled(View, { name: 'Card' })({ flexDirection: 'row' })
    const Avatar = styled(View, { name: 'Avatar' })({ borderRadius: 4 })
    interface CardProps {
      styleProps?: { root?: SheetStyleProp; avatar?: SheetStyleProp<ImageStyle> }
      children?: ReactNode
    }
    const Card = ({ styleProps = {} }: CardProps) => (
      <Root style={styleProps.root}>
        <Avatar style={styleProps.avatar} />
      </Root>
    )
    const Page = ({ kind }: { kind: 'handle' | 'hook' }) => {
      const styles = useStyle(sheet)
      const entries = kind === 'handle' ? sheet : styles
      return <Card styleProps={{ root: entries.card, avatar: entries.tone }} />
    }
    render(<Page kind="handle" />)
    const handles = calls.map((call) => call.style)
    calls.length = 0
    render(<Page kind="hook" />)
    expect(handles).toEqual(calls.map((call) => call.style))
  })
})

describe('the types of the style props on React Native', () => {
  it('takes entries of the binding and handles in SheetStyleProp, of every kind of style', () => {
    const { StyleSheet, useStyle, sheet } = setup()
    const object = StyleSheet.create({ box: { margin: 1 }, label: { fontSize: 12 } })
    expectTypeOf(sheet.card).toEqualTypeOf<ThemedEntry>()
    expectTypeOf(object.box).toEqualTypeOf<NativeSheetEntry>()
    const view: SheetStyleProp[] = [object.box, sheet.card, [false, [null, sheet.tone]], undefined]
    const text: SheetStyleProp<TextStyle> = [object.label, sheet.card]
    const image: SheetStyleProp<ImageStyle> = object.box
    const useEntries = () => {
      const styles = useStyle(sheet)
      const fromHook: SheetStyleProp<ViewStyle> = styles.card
      return fromHook
    }
    const asStyle: StyleProp = [view, text, image, { opacity: 1 }]
    expect([asStyle, useEntries]).toBeDefined()
  })

  it('rejects a plain object and a style of the platform StyleSheet, which StyleProp takes', () => {
    const own = platformSheet.create({ box: { margin: 1 } })
    // @ts-expect-error a plain object
    const plain: SheetStyleProp = { margin: 1 }
    // @ts-expect-error a style of the platform StyleSheet
    const registered: SheetStyleProp = own.box
    // @ts-expect-error a plain object in a list
    const listed: SheetStyleProp<TextStyle> = [{ fontSize: 1 }]
    const taken: StyleProp = [{ margin: 1 }, own.box]
    expect([plain, registered, listed, taken]).toBeDefined()
  })
})
