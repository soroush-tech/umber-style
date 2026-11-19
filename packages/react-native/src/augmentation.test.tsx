import { render } from '@testing-library/react'
import { createElement } from 'react'
import { expectTypeOf } from 'vitest'
import { createDefaultStyle } from './defaultStyle'

declare module '@umber-style/core' {
  interface Theme {
    palette: { primary: string }
    space: number[]
  }
}

const light = { palette: { primary: '#0000ff' }, space: [0, 4] }

describe('the theme type of the default style on React Native', () => {
  it('types theme in a style function and in useTheme', () => {
    const { styled, ThemeProvider, useTheme } = createDefaultStyle()
    const View = (props: Record<string, unknown>) => createElement('view', { id: props.id })
    const Box = styled(View)(({ theme }) => {
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      expectTypeOf(theme.space).toEqualTypeOf<number[]>()
      return { padding: theme.space[1] }
    })
    expectTypeOf<ReturnType<typeof useTheme>['palette']['primary']>().toEqualTypeOf<string>()
    const { container } = render(
      <ThemeProvider theme={light}>
        <Box id="a" />
      </ThemeProvider>
    )
    expect(container.querySelector('view')?.id).toBe('a')
  })
})
