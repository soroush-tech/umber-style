import { act, render } from '@testing-library/react'
import { Component, createElement, createRef, type Ref } from 'react'
import { platform } from '../vitest.react-native'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import type { NativeSheetEntry } from './nativeStyle'
import type { NativeTheme } from './nativeTheme'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }
const dark = { palette: { primary: '#8888ff' }, space: [0, 2, 4] }

// A key is typed as a string, as a key computed from a breakpoint is.
const wide: string = '@media (min-width: 600px)'

type AppTheme = NativeTheme<typeof theme>
type Styles = { card: NativeSheetEntry; tone: NativeSheetEntry }

const resize = (width: number, height = 800) => act(() => platform.resize(width, height))

afterEach(() => {
  platform.resize(400, 800)
  platform.setColorScheme('light')
})

describe('withTheme on React Native', () => {
  it('gives a class component the theme that useTheme() returns, under nested providers', () => {
    const { ThemeProvider, useTheme, withTheme } = createStyle(theme)
    const seen: Record<string, AppTheme> = {}
    const read: Record<string, AppTheme> = {}
    class Card extends Component<{ id: string; theme: AppTheme }> {
      render() {
        seen[this.props.id] = this.props.theme
        return null
      }
    }
    const Probe = ({ id }: { id: string }) => {
      read[id] = useTheme()
      return null
    }
    const ThemedCard = withTheme(Card)
    render(
      <>
        <ThemedCard id="none" />
        <Probe id="none" />
        <ThemeProvider theme={theme}>
          <ThemeProvider theme={dark}>
            <ThemedCard id="nested" />
            <Probe id="nested" />
          </ThemeProvider>
        </ThemeProvider>
      </>
    )
    for (const id of ['none', 'nested']) expect(seen[id]).toBe(read[id])
    expect(seen.nested.palette.primary).toBe('#8888ff')
  })
})

describe('withStyle on React Native', () => {
  it('gives the entries useStyle gives, and follows the providers, a rotation of the window and the color scheme', () => {
    const style = createStyle(theme)
    const { StyleSheet, ThemeProvider, useStyle, withStyle } = style
    const sheet = StyleSheet.create((view) => ({
      card: { padding: view.space[1], [wide]: { padding: view.space[2] } },
      tone: { [style.when(dark)]: { opacity: 0.5 }, [style.whenScheme('dark')]: { margin: 3 } },
    }))
    const seen: Styles[] = []
    const read: Styles[] = []
    class Card extends Component<{ styles: Styles }> {
      render() {
        seen.push(this.props.styles)
        return null
      }
    }
    const Probe = () => {
      read.push(useStyle(sheet))
      return null
    }
    const StyledCard = withStyle(sheet)(Card)
    render(
      <ThemeProvider theme={dark}>
        <StyledCard />
        <Probe />
      </ThemeProvider>
    )
    expect(seen.at(-1)).toEqual({ card: { padding: 2 }, tone: { opacity: 0.5 } })
    expect(seen.at(-1)?.card).toBe(read.at(-1)?.card)
    resize(800, 400)
    expect(seen.at(-1)?.card).toEqual({ padding: 4 })
    expect(seen.at(-1)?.card).toBe(read.at(-1)?.card)
    act(() => platform.setColorScheme('dark'))
    expect(seen.at(-1)?.tone).toEqual({ opacity: 0.5, margin: 3 })
    expect(seen.at(-1)).toEqual(read.at(-1))
  })

  it('gives an object sheet as it is', () => {
    const { StyleSheet, withStyle } = createStyle(theme)
    const sheet = StyleSheet.create({ card: { padding: 4 } })
    let seen: unknown
    const Card = ({ styles }: { styles: { card: NativeSheetEntry } }) => {
      seen = styles
      return null
    }
    const StyledCard = withStyle(sheet)(Card)
    render(<StyledCard />)
    expect(seen).toBe(sheet)
  })
})

describe('what both wrappers keep on React Native', () => {
  it('forwards ref, keeps the statics that are not React own, and names the wrapper', () => {
    const { StyleSheet, withStyle, withTheme } = createStyle(theme)
    const sheet = StyleSheet.create({ field: { padding: 4 } })
    class Card extends Component<{ theme: AppTheme }> {
      static defaultProps = {}
      static Item = 'item'
      render() {
        return null
      }
    }
    const Field = ({
      ref,
      styles,
    }: {
      ref?: Ref<HTMLElement>
      styles: { field: NativeSheetEntry }
    }) => createElement('view', { ref, 'data-padding': styles.field.padding })
    Field.displayName = 'TextField'
    const ThemedCard = withTheme(Card)
    const StyledField = withStyle(sheet)(Field)
    const card = createRef<Card>()
    const field = createRef<HTMLElement>()
    render(
      <>
        <ThemedCard ref={card} />
        <StyledField ref={field} />
      </>
    )
    expect(card.current).toBeInstanceOf(Card)
    expect(field.current?.dataset.padding).toBe('4')
    expect(ThemedCard.Item).toBe('item')
    expect(Object.hasOwn(ThemedCard, 'defaultProps')).toBe(false)
    expect(ThemedCard.displayName).toBe('withTheme(Card)')
    expect(StyledField.displayName).toBe('withStyle(TextField)')
    expect(withTheme((_props: { theme: AppTheme }) => null).displayName).toBe(
      'withTheme(Component)'
    )
  })

  it('leaves configure of the default style open', () => {
    const style = createDefaultStyle()
    const sheet = style.StyleSheet.create({ card: { padding: 4 } })
    let seen: { theme?: object; styles?: object } = {}
    const Card = (props: { theme: object; styles: { card: NativeSheetEntry } }) => {
      seen = props
      return null
    }
    const Wrapped = style.withTheme(style.withStyle(sheet)(Card))
    style.configure({ theme: theme as never })
    render(<Wrapped />)
    expect(seen.theme).toEqual(theme)
    expect(seen.styles).toBe(sheet)
  })
})
