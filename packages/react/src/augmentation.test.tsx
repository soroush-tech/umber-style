import { render, screen } from '@testing-library/react'
import { expectTypeOf } from 'vitest'
import { createDefaultStyle } from './defaultStyle'

// The one line an app writes, once, to type `theme` everywhere: in the core's module, for a theme
// that every binding shares.
declare module '@umber-style/core' {
  interface Theme {
    palette: { primary: string; onPrimary: string }
    space: number[]
  }
}

// And in the binding's module, for React alone: the binding's `Theme` extends the core's, so it has
// both. The member is optional so that the other files of this program, which give the core's members
// only, still compile.
declare module '@umber-style/react' {
  interface Theme {
    radii?: { card: number }
  }
}

const light = {
  palette: { primary: '#0000ff', onPrimary: '#ffffff' },
  space: [0, 4],
  radii: { card: 8 },
}

describe('the theme type of the default style', () => {
  it('types theme in a style function, in useTheme and in a sheet', () => {
    const { styled, ThemeProvider, useTheme, StyleSheet } = createDefaultStyle()

    const Button = styled('button')<{ tone?: 'a' | 'b' }>(({ theme, tone }) => {
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      expectTypeOf(theme.space).toEqualTypeOf<number[]>()
      expectTypeOf(theme.radii).toEqualTypeOf<{ card: number } | undefined>()
      expectTypeOf(tone).toEqualTypeOf<'a' | 'b' | undefined>()
      return { color: theme.palette.primary }
    })
    expectTypeOf<ReturnType<typeof useTheme>['palette']['primary']>().toEqualTypeOf<string>()
    expectTypeOf<ReturnType<typeof useTheme>['radii']>().toEqualTypeOf<
      { card: number } | undefined
    >()
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
