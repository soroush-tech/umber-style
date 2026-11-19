import { render, screen } from '@testing-library/react'
import { expectTypeOf } from 'vitest'
import { createDefaultStyle } from './defaultStyle'

// The one line an app writes, once, to type `theme` everywhere.
declare module '@umber-style/core' {
  interface Theme {
    palette: { primary: string; onPrimary: string }
    space: number[]
  }
}

const light = { palette: { primary: '#0000ff', onPrimary: '#ffffff' }, space: [0, 4] }

describe('the theme type of the default style', () => {
  it('types theme in a style function, in useTheme and in a sheet', () => {
    const { styled, ThemeProvider, useTheme, StyleSheet } = createDefaultStyle()

    const Button = styled('button')<{ tone?: 'a' | 'b' }>(({ theme, tone }) => {
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      expectTypeOf(theme.space).toEqualTypeOf<number[]>()
      expectTypeOf(tone).toEqualTypeOf<'a' | 'b' | undefined>()
      return { color: theme.palette.primary }
    })
    expectTypeOf<ReturnType<typeof useTheme>['palette']['primary']>().toEqualTypeOf<string>()
    StyleSheet.create((theme) => {
      expectTypeOf(theme.palette.onPrimary).toEqualTypeOf<string>()
      return { box: { color: theme.palette.onPrimary } }
    })

    const Reader = () => <i>{useTheme().palette.primary}</i>
    render(
      <ThemeProvider theme={light}>
        <Button tone="a" />
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Reader />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(screen.getByText('#ff0000')).toBeTruthy()
  })
})
