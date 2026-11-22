// The strict style types, switched on for the whole program that compiles this file
// (tsconfig.strict.json), with webStyle.test.ts and globalStyles.test.ts, which assert them.
import { expectTypeOf } from 'vitest'
import { createCache, createLazyEngine, createMemorySheet, type WebStyleObject } from './index'

declare module '@umber-style/core' {
  interface StyleTypeOptions {
    isStrict: true
  }
}

describe('the strict style types', () => {
  it('are switched on by isStrict in StyleTypeOptions', () => {
    const engine = createLazyEngine({
      cache: createCache({ hasLayers: false, prefix: 's', sheet: createMemorySheet() }),
    })
    const widened = { display: 'flex' as string }
    // @ts-expect-error a display that was widened to string is not one of its keywords
    const style: WebStyleObject = widened
    // @ts-expect-error a misspelt property
    expect(engine.css({ backgroudColor: 'red' })).toMatch(/^s-/)
    expect(style).toEqual({ display: 'flex' })
    expectTypeOf<WebStyleObject['display']>().not.toEqualTypeOf<string>()
  })
})
