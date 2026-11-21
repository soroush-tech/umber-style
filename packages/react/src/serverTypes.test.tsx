// The type tests of the server build, read through the package name as a consumer reads it: `pnpm
// typecheck` compiles this file with the `react-server` export condition (tsconfig.server.json), where
// `useTheme` is a plain function and `readTheme` another name of it. Under vitest it runs against the
// client build, so it only checks types and calls nothing that the server build alone has.
import { expectTypeOf } from 'vitest'
import {
  createStyle,
  css,
  readTheme,
  useTheme,
  type CSSObject,
  type SerializedStyles,
  type Theme,
  type WebStyleObject,
} from '@umber-style/react'
// @ts-expect-error the server build has no context
import { ThemeContext } from '@umber-style/react'

describe('the types of the server build', () => {
  it('has useTheme and readTheme, and no ThemeContext', () => {
    const style = createStyle({ palette: { primary: '#0000ff' } })
    expectTypeOf(style.useTheme).returns.toEqualTypeOf<{ palette: { primary: string } }>()
    expectTypeOf(style.readTheme).returns.toEqualTypeOf<{ palette: { primary: string } }>()
    expectTypeOf(style).not.toHaveProperty('ThemeContext')
    expectTypeOf(useTheme).returns.not.toBeAny()
    expectTypeOf(readTheme).returns.not.toBeAny()
    expectTypeOf(ThemeContext).toBeAny()
    expectTypeOf<WebStyleObject>().not.toBeAny()
  })

  it('has css, and the type names that apps import', () => {
    expectTypeOf(css).returns.toEqualTypeOf<SerializedStyles>()
    expectTypeOf(createStyle({}).css).returns.toEqualTypeOf<SerializedStyles>()
    expectTypeOf<CSSObject>().toEqualTypeOf<WebStyleObject>()
    expectTypeOf<Theme>().toHaveProperty('_theme')
  })
})
