// The type tests of `umber-style/react` and `@umber-style/react` under the `react-server` export
// condition: `pnpm typecheck` compiles this file with it (tsconfig.server.json). The server build has
// `readTheme` and no `useTheme`. Under vitest it runs against the client build, so it only checks types.
import { readTheme as readServerTheme } from '@umber-style/react'
import { expectTypeOf } from 'vitest'
import {
  createStyle,
  readTheme,
  styled,
  type SharedServerStyle,
  type WebStyleObject,
} from 'umber-style/react'
// @ts-expect-error the server build has no useTheme
import { useTheme } from 'umber-style/react'

describe('the types of the server build', () => {
  it('has readTheme, and no useTheme', () => {
    expectTypeOf(readTheme).toBeFunction()
    expectTypeOf(readServerTheme).toBeFunction()
    expectTypeOf(readTheme).returns.not.toBeAny()
    expectTypeOf(useTheme).toBeAny()
    const style = createStyle({ palette: { primary: '#0000ff' } })
    expectTypeOf(style).toEqualTypeOf<SharedServerStyle<{ palette: { primary: string } }>>()
    expectTypeOf(style.readTheme).returns.toEqualTypeOf<{ palette: { primary: string } }>()
    expectTypeOf(style).not.toHaveProperty('useTheme')
    expectTypeOf(styled).toBeFunction()
    expectTypeOf<WebStyleObject>().not.toBeAny()
  })
})
