// The type tests of `umber-style/react` and `@umber-style/react` under the `react-server` export
// condition: `pnpm typecheck` compiles this file with it (tsconfig.server.json). The server build has
// `useTheme`, a plain function there, and `readTheme`, another name of it. Under vitest it runs against
// the client build, so it only checks types.
import { readTheme as readServerTheme, useTheme as useServerTheme } from '@umber-style/react'
import { expectTypeOf } from 'vitest'
import {
  createStyle,
  readTheme,
  styled,
  useTheme,
  type SharedServerStyle,
  type WebStyleObject,
} from 'umber-style/react'
// @ts-expect-error the server build has no ThemeScope: there is no portal in server components
import { ThemeScope } from 'umber-style/react'

describe('the types of the server build', () => {
  it('has useTheme, and readTheme with it', () => {
    expectTypeOf(useTheme).toBeFunction()
    expectTypeOf(useTheme).returns.not.toBeAny()
    expectTypeOf(useServerTheme).toBeFunction()
    expectTypeOf(readTheme).toBeFunction()
    expectTypeOf(readServerTheme).toBeFunction()
    expectTypeOf(readTheme).returns.not.toBeAny()
    const style = createStyle({ palette: { primary: '#0000ff' } })
    expectTypeOf(style).toEqualTypeOf<SharedServerStyle<{ palette: { primary: string } }>>()
    expectTypeOf(style.useTheme).returns.toEqualTypeOf<{ palette: { primary: string } }>()
    expectTypeOf(style.readTheme).returns.toEqualTypeOf<{ palette: { primary: string } }>()
    expectTypeOf(style).not.toHaveProperty('ThemeContext')
    expectTypeOf(style).not.toHaveProperty('ThemeScope')
    expectTypeOf(style).not.toHaveProperty('useThemeClass')
    expectTypeOf(ThemeScope).toBeAny()
    expectTypeOf(styled).toBeFunction()
    expectTypeOf<WebStyleObject>().not.toBeAny()
  })
})
