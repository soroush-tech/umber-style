// The strict style types, switched on through this binding for the whole program that compiles this
// file (tsconfig.strict.json), with the type tests that assert them.
import type { CSSProperties } from 'react'
import { expectTypeOf } from 'vitest'
import type { StyleProp, WebStyleObject } from './index'

declare module '@umber-style/react' {
  interface StyleTypeOptions {
    isStrict: true
  }
}

describe('the strict style types', () => {
  it('are switched on by isStrict in the StyleTypeOptions of the binding, and take no CSSProperties in style', () => {
    expectTypeOf<CSSProperties>().not.toExtend<StyleProp>()
    expectTypeOf<{ display: string }>().not.toExtend<WebStyleObject>()
    // @ts-expect-error a misspelt property
    const typo: WebStyleObject = { backgroudColor: 'red' }
    expect(typo).toEqual({ backgroudColor: 'red' })
  })
})
