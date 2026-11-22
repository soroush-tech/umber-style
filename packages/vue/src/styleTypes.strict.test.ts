// The strict style types, switched on through this binding for the whole program that compiles this
// file (tsconfig.strict.json), with webStyle.test.ts, which asserts them.
import { expectTypeOf } from 'vitest'
import type { WebStyleObject } from './index'

declare module '@umber-style/vue' {
  interface StyleTypeOptions {
    isStrict: true
  }
}

describe('the strict style types', () => {
  it('are switched on by isStrict in the StyleTypeOptions of the binding', () => {
    expectTypeOf<{ display: string }>().not.toExtend<WebStyleObject>()
    // @ts-expect-error a misspelt property
    const typo: WebStyleObject = { backgroudColor: 'red' }
    expect(typo).toEqual({ backgroudColor: 'red' })
  })
})
