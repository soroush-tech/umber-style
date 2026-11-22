// The strict style types, switched on through `umber-style/react` for the whole program that compiles
// this file (tsconfig.strict.json, and tsconfig.strict.native.json with the `react-native` condition),
// with the type tests that assert them.
import { expectTypeOf } from 'vitest'
import type { WebStyleObject } from './shared'

declare module 'umber-style/react' {
  interface StyleTypeOptions {
    isStrict: true
  }
}

describe('the strict style types', () => {
  it('are switched on by isStrict in the StyleTypeOptions of umber-style/react', () => {
    expectTypeOf<{ display: string }>().not.toExtend<WebStyleObject>()
    // @ts-expect-error a misspelt property in the web part
    const typo: WebStyleObject = { backgroudColor: 'red' }
    expect(typo).toEqual({ backgroudColor: 'red' })
  })
})
