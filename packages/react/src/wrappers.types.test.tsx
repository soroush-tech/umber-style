// The type tests of withTheme and withStyle, and the class component of docs/react.md, which runs too.
import { render, screen } from '@testing-library/react'
import { Component, createRef, type Ref } from 'react'
import { expectTypeOf } from 'vitest'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import type { SheetEntry, Theme } from './types'

// The example of docs/react.md, from here to the end of the class.
const lightTheme = { palette: { primary: '#1b5fd1', surface: '#ffffff' }, space: [0, 4, 8, 16] }

const { StyleSheet, apply, withStyle, withTheme } = createStyle(lightTheme, { prefix: 'doc' })

const sheet = StyleSheet.create((theme) => ({
  card: { padding: theme.space[3], background: theme.palette.surface },
}))

interface CardProps {
  title: string
  theme: typeof lightTheme
  styles: { card: SheetEntry }
}

class Card extends Component<CardProps> {
  static variant = 'outlined'

  render() {
    const { title, theme, styles } = this.props
    return (
      <section {...apply(styles.card)} data-accent={theme.palette.primary}>
        {title}
      </section>
    )
  }
}

// The props of Card without theme and styles, its ref, and its statics.
export const ThemedCard = withTheme(withStyle(sheet)(Card))

// The example of docs/style-sheets.md.
class Panel extends Component<{ title: string; styles: { card: SheetEntry } }> {
  render() {
    return <section {...apply(this.props.styles.card)}>{this.props.title}</section>
  }
}

export const StyledPanel = withStyle(sheet)(Panel)

describe('the types of withTheme and withStyle', () => {
  it('runs the example of the docs: a class component with theme and styles, its ref and its statics', () => {
    const ref = createRef<Card>()
    render(<ThemedCard title="Plan" ref={ref} />)
    const section = screen.getByText('Plan')
    expect(section.dataset.accent).toBe('#1b5fd1')
    expect(section.className).toMatch(/^doc-/)
    expect(ref.current).toBeInstanceOf(Card)
    expect(ThemedCard.variant).toBe('outlined')
    expect(ThemedCard.displayName).toBe('withTheme(withStyle(Card))')
    render(<StyledPanel title="Panel" />)
    expect(screen.getByText('Panel').className).toBe(section.className)
    expect(StyledPanel.displayName).toBe('withStyle(Panel)')
  })

  it('takes the props of the component without theme or styles, and its ref', () => {
    expect(<ThemedCard title="a" />).toBeDefined()
    // @ts-expect-error the wrapper gives theme itself
    expect(<ThemedCard title="a" theme={lightTheme} />).toBeDefined()
    // @ts-expect-error the wrapper gives styles itself
    expect(<ThemedCard title="a" styles={{ card: sheet.card }} />).toBeDefined()
    // @ts-expect-error a prop of the component is still required
    expect(<ThemedCard />).toBeDefined()
    // @ts-expect-error the ref of a class component is its instance
    expect(<ThemedCard title="a" ref={createRef<HTMLDivElement>()} />).toBeDefined()
    expectTypeOf(ThemedCard.variant).toEqualTypeOf<string>()
    expectTypeOf(ThemedCard).not.toHaveProperty('prototype')
  })

  it('types theme as useTheme() returns it, and rejects a component whose theme is another type', () => {
    const { withTheme: wrapTheme } = createStyle({ palette: { primary: '#0000ff' } })
    const Plain = (props: { theme: { palette: { primary: string } }; id: string }) => {
      expectTypeOf(props.theme.palette.primary).toEqualTypeOf<string>()
      return null
    }
    const Wrapped = wrapTheme(Plain)
    expectTypeOf<Parameters<typeof Wrapped>[0]>().toEqualTypeOf<{ id: string }>()
    const Other = (_props: { theme: { colors: string[] } }) => null
    // @ts-expect-error its theme is not the theme of the style
    expect(wrapTheme(Other)).toBeDefined()
    // The default style: the registered Theme.
    const { withTheme: wrapDefault } = createDefaultStyle()
    class Registered extends Component<{ theme: Theme }> {
      render() {
        return null
      }
    }
    expect(wrapDefault(Registered)).toBeDefined()
    // @ts-expect-error the registered Theme has no colors
    expect(wrapDefault(Other)).toBeDefined()
  })

  it('types styles as useStyle(sheet) returns them, and rejects a misspelt name of the sheet', () => {
    const object = StyleSheet.create({ card: { padding: 4 }, title: { margin: 2 } })
    const Field = ({
      ref,
      styles,
    }: {
      ref?: Ref<HTMLInputElement>
      styles: { card: SheetEntry }
    }) => <input ref={ref} {...apply(styles.card)} />
    const StyledField = withStyle(object)(Field)
    expect(<StyledField ref={createRef<HTMLInputElement>()} />).toBeDefined()
    const Misspelt = (_props: { styles: { crad: SheetEntry } }) => null
    // @ts-expect-error the sheet has no entry crad
    expect(withStyle(object)(Misspelt)).toBeDefined()
    // @ts-expect-error nor has the sheet of the theme
    expect(withStyle(sheet)(Misspelt)).toBeDefined()
    const NotEntries = (_props: { styles: { card: number } }) => null
    // @ts-expect-error an entry is not a number
    expect(withStyle(object)(NotEntries)).toBeDefined()
    // @ts-expect-error an entry alone is not a sheet
    expect(withStyle(object.card)).toBeDefined()
  })
})
