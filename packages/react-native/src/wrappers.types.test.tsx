// The type tests of withTheme and withStyle on React Native, and the class component of
// docs/react-native.md, which runs too.
import { render, screen } from '@testing-library/react'
import { Component, createRef } from 'react'
import { Text, View } from 'react-native'
import { expectTypeOf } from 'vitest'
import { createStyle, type NativeSheetEntry, type NativeTheme } from './index'

// The example of docs/react-native.md, from here to the end of the class.
const lightTheme = { palette: { primary: '#1b5fd1', surface: '#ffffff' }, space: [0, 4, 8, 16] }

const { StyleSheet, withStyle, withTheme } = createStyle(lightTheme)

const sheet = StyleSheet.create((theme) => ({
  card: { padding: theme.space[3], backgroundColor: theme.palette.surface },
  title: { color: theme.palette.primary },
}))

interface CardProps {
  title: string
  theme: NativeTheme<typeof lightTheme>
  styles: { card: NativeSheetEntry; title: NativeSheetEntry }
}

class Card extends Component<CardProps> {
  static variant = 'outlined'

  render() {
    const { title, theme, styles } = this.props
    return (
      <View style={styles.card}>
        <Text style={[styles.title, { borderColor: theme.palette.primary }]}>{title}</Text>
      </View>
    )
  }
}

// The props of Card without theme and styles, its ref, and its statics.
export const ThemedCard = withTheme(withStyle(sheet)(Card))

describe('the types of withTheme and withStyle on React Native', () => {
  it('runs the example of the docs: a class component with theme and styles, and its ref', () => {
    const ref = createRef<Card>()
    render(<ThemedCard title="Plan" ref={ref} />)
    expect(screen.getByText('Plan')).toBeDefined()
    expect(ref.current?.props.styles.title).toEqual({ color: '#1b5fd1' })
    expect(ThemedCard.variant).toBe('outlined')
  })

  it('takes the props of the component without theme or styles, and its ref', () => {
    expect(<ThemedCard title="a" />).toBeDefined()
    // @ts-expect-error the wrapper gives theme itself
    expect(<ThemedCard title="a" theme={lightTheme} />).toBeDefined()
    // @ts-expect-error the wrapper gives styles itself
    expect(<ThemedCard title="a" styles={{}} />).toBeDefined()
    // @ts-expect-error a prop of the component is still required
    expect(<ThemedCard />).toBeDefined()
    // @ts-expect-error the ref of a class component is its instance
    expect(<ThemedCard title="a" ref={createRef<HTMLDivElement>()} />).toBeDefined()
    expectTypeOf(ThemedCard.variant).toEqualTypeOf<string>()
  })

  it('types theme as useTheme() returns it, and styles as useStyle(sheet) does', () => {
    const Plain = (props: { theme: NativeTheme<typeof lightTheme>; id: string }) => {
      expectTypeOf(props.theme.space).toEqualTypeOf<number[]>()
      return null
    }
    expectTypeOf<Parameters<ReturnType<typeof withTheme<typeof Plain>>>[0]>().toEqualTypeOf<{
      id: string
    }>()
    const Other = (_props: { theme: { colors: string[] } }) => null
    // @ts-expect-error its theme is not the theme of the style
    expect(withTheme(Other)).toBeDefined()
    const Misspelt = (_props: { styles: { crad: NativeSheetEntry } }) => null
    // @ts-expect-error the sheet has no entry crad
    expect(withStyle(sheet)(Misspelt)).toBeDefined()
    const object = StyleSheet.create({ card: { padding: 4 } })
    // @ts-expect-error nor has the object sheet
    expect(withStyle(object)(Misspelt)).toBeDefined()
  })
})
