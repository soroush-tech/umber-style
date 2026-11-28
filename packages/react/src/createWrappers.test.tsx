import { render, screen } from '@testing-library/react'
import { Component, createRef, type Ref } from 'react'
import { createCache, createMemorySheet, type SheetEntry } from '@umber-style/core'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const theme = { palette: { primary: '#0000ff', surface: '#ffffff' } }
const nestedTheme = { palette: { surface: '#fff4d6' } }

type AppTheme = typeof theme

/** A style with its own in-memory sheet. */
function setup(prefix = 'wr') {
  return createStyle(theme, {
    prefix,
    cache: createCache({ hasLayers: false, prefix, sheet: createMemorySheet() }),
  })
}

describe('withTheme', () => {
  it('gives a class component the theme that useTheme() returns, under nested providers', () => {
    const { ThemeProvider, useTheme, withTheme } = setup()
    const seen: Record<string, AppTheme> = {}
    const read: Record<string, AppTheme> = {}
    class Card extends Component<{ id: string; theme: AppTheme }> {
      render() {
        seen[this.props.id] = this.props.theme
        return <p data-testid={this.props.id}>{this.props.theme.palette.surface}</p>
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
          <ThemedCard id="outer" />
          <Probe id="outer" />
          <ThemeProvider theme={nestedTheme}>
            <ThemedCard id="nested" />
            <Probe id="nested" />
          </ThemeProvider>
        </ThemeProvider>
      </>
    )
    for (const id of ['none', 'outer', 'nested']) expect(seen[id]).toBe(read[id])
    expect(screen.getByTestId('outer').textContent).toBe('#ffffff')
    expect(screen.getByTestId('nested').textContent).toBe('#fff4d6')
  })

  it('sets theme over a theme prop the wrapper is given anyway', () => {
    const { withTheme } = setup()
    const Card = ({ theme: given }: { theme: AppTheme }) => <p>{given.palette.primary}</p>
    const ThemedCard = withTheme(Card)
    render(<ThemedCard {...({ theme: { palette: { primary: 'red' } } } as object)} />)
    expect(screen.getByText('#0000ff')).toBeDefined()
  })
})

describe('withStyle', () => {
  it('gives a class component the entries of an object sheet: the sheet itself, as useStyle returns it', () => {
    const { StyleSheet, apply, useStyle, withStyle } = setup()
    const sheet = StyleSheet.create({ card: { padding: 8 }, title: { margin: 2 } })
    let seen: { card: SheetEntry; title: SheetEntry } | undefined
    let read: unknown
    class Card extends Component<{ styles: { card: SheetEntry; title: SheetEntry } }> {
      render() {
        seen = this.props.styles
        return <p data-testid="card" {...apply(this.props.styles.card)} />
      }
    }
    const Probe = () => {
      read = useStyle(sheet)
      return null
    }
    const StyledCard = withStyle(sheet)(Card)
    render(
      <>
        <StyledCard />
        <Probe />
      </>
    )
    expect(seen).toBe(read)
    expect(seen).toBe(sheet)
    expect(screen.getByTestId('card').className).toBe(String(sheet.card))
  })

  it('gives the entries of a sheet made from a function of the theme, the same objects useStyle gives under the same provider', () => {
    const { StyleSheet, ThemeProvider, useStyle, withStyle } = setup()
    const sheet = StyleSheet.create((current) => ({
      card: { color: current.palette.primary, background: current.palette.surface },
    }))
    const seen: Record<string, { card: SheetEntry }> = {}
    const read: Record<string, { card: SheetEntry }> = {}
    class Card extends Component<{ id: string; styles: { card: SheetEntry } }> {
      render() {
        seen[this.props.id] = this.props.styles
        return null
      }
    }
    const Probe = ({ id }: { id: string }) => {
      read[id] = useStyle(sheet)
      return null
    }
    const StyledCard = withStyle(sheet)(Card)
    render(
      <ThemeProvider theme={theme}>
        <StyledCard id="outer" />
        <Probe id="outer" />
        <ThemeProvider theme={nestedTheme}>
          <StyledCard id="nested" />
          <Probe id="nested" />
        </ThemeProvider>
      </ThemeProvider>
    )
    for (const id of ['outer', 'nested']) expect(seen[id].card).toBe(read[id].card)
    expect(String(seen.outer.card)).toMatch(/^wr-/)
  })
})

describe('what both wrappers keep', () => {
  it('forwards ref to the instance of a class component and to the element of a function component', () => {
    const { StyleSheet, apply, withStyle, withTheme } = setup()
    class Card extends Component<{ theme: AppTheme }> {
      render() {
        return null
      }
    }
    const sheet = StyleSheet.create({ field: { padding: 4 } })
    const Field = ({
      ref,
      styles,
    }: {
      ref?: Ref<HTMLInputElement>
      styles: { field: SheetEntry }
    }) => <input ref={ref} {...apply(styles.field)} />
    const ThemedCard = withTheme(Card)
    const StyledField = withStyle(sheet)(Field)
    const card = createRef<Card>()
    const field = createRef<HTMLInputElement>()
    render(
      <>
        <ThemedCard ref={card} />
        <StyledField ref={field} />
      </>
    )
    expect(card.current).toBeInstanceOf(Card)
    expect(card.current?.props.theme).toBe(theme)
    expect(field.current?.tagName).toBe('INPUT')
  })

  it('keeps the statics of the component that are not React own, which it still reads itself', () => {
    const { StyleSheet, withStyle, withTheme } = setup()
    const sheet = StyleSheet.create({ card: { padding: 4 } })
    class Card extends Component<{
      label?: string
      theme: AppTheme
      styles: { card: SheetEntry }
    }> {
      static defaultProps = { label: 'default' }
      static Item = 'item'
      static readSize() {
        return 2
      }
      render() {
        return <p data-testid="card">{this.props.label}</p>
      }
    }
    const symbol = Symbol('static')
    Object.assign(Card, { [symbol]: 'symbol' })
    const ThemedCard = withTheme(Card)
    const StyledCard = withStyle(sheet)(Card)
    for (const Wrapped of [ThemedCard, StyledCard]) {
      expect(Wrapped.Item).toBe('item')
      expect(Wrapped.readSize()).toBe(2)
      expect((Wrapped as unknown as Record<symbol, string>)[symbol]).toBe('symbol')
      expect(Object.hasOwn(Wrapped, 'defaultProps')).toBe(false)
      expect(Wrapped.prototype).not.toBe(Card.prototype)
    }
    render(<ThemedCard styles={sheet} />)
    expect(screen.getByTestId('card').textContent).toBe('default')
  })

  it('names the wrapper after the display name or the name of the component', () => {
    const { StyleSheet, withStyle, withTheme } = setup()
    const sheet = StyleSheet.create({ card: { padding: 4 } })
    class Card extends Component<{ theme: AppTheme }> {
      render() {
        return null
      }
    }
    const Named = (_props: { styles: { card: SheetEntry } }) => null
    Named.displayName = 'Fancy'
    expect(withTheme(Card).displayName).toBe('withTheme(Card)')
    expect(withStyle(sheet)(Named).displayName).toBe('withStyle(Fancy)')
    expect(withTheme((_props: { theme: AppTheme }) => null).displayName).toBe(
      'withTheme(Component)'
    )
  })
})

describe('the wrappers of the default style', () => {
  it('leave configure open, and read the configured style when they render', () => {
    const style = createDefaultStyle()
    const sheet = style.StyleSheet.create({ card: { padding: 4 } })
    const Card = ({ theme: given, styles }: { theme: object; styles: { card: SheetEntry } }) => (
      <p data-testid="default" {...style.apply(styles.card)}>
        {(given as AppTheme).palette.primary}
      </p>
    )
    const Wrapped = style.withTheme(style.withStyle(sheet)(Card))
    style.configure({ prefix: 'wrd', theme: theme as never })
    render(<Wrapped />)
    expect(screen.getByTestId('default').textContent).toBe('#0000ff')
    expect(screen.getByTestId('default').className).toMatch(/^wrd-/)
  })
})
