// withTheme and withStyle in one source for web and mobile: the source runs on both bindings, and its
// types are checked through `umber-style/react`, which `pnpm typecheck` compiles with and without the
// `react-native` export condition, and with the `react-server` one.
import { render, screen } from '@testing-library/react'
import { Component, createElement, createRef, type ElementType } from 'react'
import { expectTypeOf } from 'vitest'
import {
  StyleSheet as DefaultSheet,
  withStyle as withDefaultStyle,
  withTheme as withDefaultTheme,
  type SharedEntry,
  type Theme,
} from 'umber-style/react'
import { createCache, createMemorySheet } from './index'
import { createStyle as createWebStyle } from './react'
import { createStyle as createNativeStyle } from './react-native'
import type { SharedStyle } from './shared'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

type AppTheme = typeof theme

/** The one source: a class component with the theme and the entries of a sheet, wrapped by both. */
function createCard(binding: SharedStyle<AppTheme>, Host: ElementType) {
  const { styled, StyleSheet, withStyle, withTheme } = binding
  const Box = styled(Host)({ margin: 2 })
  const sheet = StyleSheet.create((current) => ({ card: { padding: current.space[1] } }))
  class Card extends Component<{ label: string; theme: AppTheme; styles: { card: SharedEntry } }> {
    render() {
      const { label, theme: current, styles } = this.props
      return (
        <Box style={styles.card} data-color={current.palette.primary}>
          {label}
        </Box>
      )
    }
  }
  return { Card, ThemedCard: withTheme(withStyle(sheet)(Card)) }
}

describe('withTheme and withStyle in one source for web and mobile', () => {
  it('on the web gives the class component the theme and the class of its entry', () => {
    const memory = createMemorySheet()
    const binding = createWebStyle(theme, {
      prefix: 'sw',
      cache: createCache({ prefix: 'sw', sheet: memory, hasLayers: false }),
    })
    const { Card, ThemedCard } = createCard(binding as unknown as SharedStyle<AppTheme>, 'div')
    const ref = createRef<InstanceType<typeof Card>>()
    render(<ThemedCard label="web" ref={ref} />)
    const element = screen.getByText('web')
    expect(element.dataset.color).toBe('#0000ff')
    expect(ref.current).toBeInstanceOf(Card)
    // The entry joins the one class of the element, its padding a reference to the token.
    expect(memory.rules).toEqual([`.${element.className}{margin:2px;padding:var(--sw-space-1);}`])
  })

  it('on React Native gives the class component the theme and the registered entry', () => {
    const calls: Record<string, unknown>[] = []
    const Host = (props: Record<string, unknown>) => {
      calls.push(props)
      return createElement('view', null, props.children as string)
    }
    const binding = createNativeStyle(theme)
    const { Card, ThemedCard } = createCard(binding as unknown as SharedStyle<AppTheme>, Host)
    const ref = createRef<InstanceType<typeof Card>>()
    render(<ThemedCard label="native" ref={ref} />)
    expect(calls.at(-1)?.['data-color']).toBe('#0000ff')
    expect(calls.at(-1)?.style).toEqual([{ margin: 2 }, { padding: 4 }])
    expect(ref.current).toBeInstanceOf(Card)
  })

  it('types the props of the wrappers: theme and styles removed, the sheet names checked', () => {
    const sheet = DefaultSheet.create({ card: { padding: 4 } })
    class Card extends Component<{ id: string; theme: Theme; styles: { card: SharedEntry } }> {
      render() {
        expectTypeOf(this.props.styles.card).toEqualTypeOf<SharedEntry>()
        return null
      }
    }
    const Wrapped = withDefaultTheme(withDefaultStyle(sheet)(Card))
    expect(<Wrapped id="a" ref={createRef<Card>()} />).toBeDefined()
    // @ts-expect-error the wrapper gives theme itself
    expect(<Wrapped id="a" theme={{}} />).toBeDefined()
    // @ts-expect-error the wrapper gives styles itself
    expect(<Wrapped id="a" styles={sheet} />).toBeDefined()
    const Misspelt = (_props: { styles: { crad: SharedEntry } }) => null
    // @ts-expect-error the sheet has no entry crad
    expect(withDefaultStyle(sheet)(Misspelt)).toBeDefined()
    const Other = (_props: { theme: { colors: string[] } }) => null
    // @ts-expect-error its theme is not the registered Theme
    expect(withDefaultTheme(Other)).toBeDefined()
  })
})
