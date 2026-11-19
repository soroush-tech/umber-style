// The type tests of the server build, read through the package name as a consumer reads it: `pnpm
// typecheck` compiles this file with the `react-server` export condition (tsconfig.server.json), where
// `readTheme` exists and `useTheme` does not. Under vitest it runs against the client build, so it only
// checks types and calls nothing that the server build alone has.
import { expectTypeOf } from 'vitest'
import { createStyle, readTheme, type WebStyleObject } from '@umber-style/react'
// @ts-expect-error the server build has no useTheme
import { useTheme } from '@umber-style/react'

describe('the types of the server build', () => {
  it('has readTheme, and no useTheme', () => {
    const style = createStyle({ palette: { primary: '#0000ff' } })
    expectTypeOf(style.readTheme).returns.toEqualTypeOf<{ palette: { primary: string } }>()
    expectTypeOf(style).not.toHaveProperty('useTheme')
    expectTypeOf(readTheme).returns.not.toBeAny()
    expectTypeOf(useTheme).toBeAny()
    expectTypeOf<WebStyleObject>().not.toBeAny()
  })
})
