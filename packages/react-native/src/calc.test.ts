import { expectTypeOf } from 'vitest'
import { add, divide, multiply, negate, subtract } from './calc'
import type { Percent } from './calc'

describe('multiply on React Native', () => {
  it('computes numbers', () => {
    expect(multiply(8, 2)).toBe(16)
    expect(multiply(0.1, 3)).toBe(0.3)
    expect(multiply(0, -1)).toBe(0)
    expect(multiply(4, 1)).toBe(4)
    expect(multiply(4, 0)).toBe(0)
  })

  it('reads a numeric string, with px or without a unit', () => {
    expect(multiply('8', 2)).toBe(16)
    expect(multiply('8px', 2)).toBe(16)
    expect(multiply(' -1.5PX ', 2)).toBe(-3)
    expect(multiply('.5', 4)).toBe(2)
  })

  it('reads a number with a point and no digit after it, and rejects a second point', () => {
    expect(multiply('3.', 2)).toBe(6)
    expect(multiply('3.px', 2)).toBe(6)
    expect(multiply('-3.5%', 2)).toBe('-7%')
    expect(() => multiply('3..5', 2)).toThrow(TypeError)
    expect(() => multiply('.', 2)).toThrow(TypeError)
  })

  it('rejects a long run of digits that ends in something else in linear time', () => {
    const start = performance.now()
    expect(() => multiply(`${'1'.repeat(200_000)}!`, 2)).toThrow(TypeError)
    expect(() => multiply(`${'1'.repeat(200_000)}.${'1'.repeat(200_000)}!`, 2)).toThrow(TypeError)
    expect(performance.now() - start).toBeLessThan(2000)
  })

  it('keeps a percentage a percentage', () => {
    expect(multiply('50%', 2)).toBe('100%')
    expect(multiply('10%', 0.5)).toBe('5%')
    expect(multiply('10%', 0)).toBe('0%')
  })

  it('throws a TypeError that names the helper and the value, for what it cannot compute', () => {
    expect(() => multiply('var(--u-space-2)', 2)).toThrow(TypeError)
    expect(() => multiply('var(--u-space-2)', 2)).toThrow(
      /multiply\(\) cannot compute "var\(--u-space-2\)"/
    )
    expect(() => multiply('1em', 2)).toThrow(/"1em"/)
    expect(() => multiply('calc(1px + 2px)', 2)).toThrow(TypeError)
    expect(() => multiply('1px 2px', 2)).toThrow(TypeError)
  })

  it('throws for rem, which it has no base for (a theme gives it numbers already)', () => {
    expect(() => multiply('1rem', 2)).toThrow(/multiply\(\) cannot compute "1rem"/)
    expect(() => add('1rem', 2)).toThrow(TypeError)
  })

  it('throws on a factor that is not finite, and on the wrong types', () => {
    expect(() => multiply(8, Number.NaN)).toThrow(RangeError)
    expect(() => multiply(8, Number.POSITIVE_INFINITY)).toThrow(
      /multiply\(\): the factor must be finite/
    )
    expect(() => multiply(Number.NaN, 2)).toThrow(RangeError)
    expect(() => multiply(8, '2' as unknown as number)).toThrow(TypeError)
    expect(() => multiply(undefined as unknown as number, 2)).toThrow(/a value must be a number/)
  })
})

describe('divide on React Native', () => {
  it('computes numbers, numeric strings and percentages', () => {
    expect(divide(8, 2)).toBe(4)
    expect(divide(8, 3)).toBe(2.666667)
    expect(divide('9px', 3)).toBe(3)
    expect(divide('50%', 2)).toBe('25%')
  })

  it('throws a RangeError for 0, and for what it cannot compute', () => {
    expect(() => divide(8, 0)).toThrow(RangeError)
    expect(() => divide(8, 0)).toThrow(/divide\(\): the divisor must not be 0/)
    expect(() => divide(8, Number.NaN)).toThrow(/the divisor must be finite/)
    expect(() => divide('var(--x)', 2)).toThrow(/divide\(\) cannot compute/)
  })
})

describe('negate on React Native', () => {
  it('is multiply by -1', () => {
    expect(negate(8)).toBe(-8)
    expect(negate('8px')).toBe(-8)
    expect(negate('50%')).toBe('-50%')
    expect(negate(0)).toBe(0)
    expect(negate(negate(8))).toBe(8)
  })

  it('throws for what it cannot compute', () => {
    expect(() => negate('var(--x)')).toThrow(/negate\(\) cannot compute "var\(--x\)"/)
  })
})

describe('add on React Native', () => {
  it('computes numbers and numeric strings', () => {
    expect(add(4, 4)).toBe(8)
    expect(add(0.1, 0.2)).toBe(0.3)
    expect(add(1, '2px', '3')).toBe(6)
    expect(add(4)).toBe(4)
    expect(add()).toBe(0)
  })

  it('adds percentages when every operand is one', () => {
    expect(add('50%', '25%')).toBe('75%')
    expect(add('50%')).toBe('50%')
  })

  it('ignores a number 0 next to percentages', () => {
    expect(add('50%', 0)).toBe('50%')
    expect(add(0, '50%')).toBe('50%')
  })

  it('throws when a percentage meets a number, naming the value', () => {
    expect(() => add('50%', 4)).toThrow(TypeError)
    expect(() => add('50%', 4)).toThrow(/add\(\) cannot compute 4/)
    expect(() => add(4, '50%')).toThrow(/add\(\) cannot compute 4/)
    expect(() => add('50%', '4px')).toThrow(/"4px"/)
    expect(() => add('var(--x)', 4)).toThrow(/"var\(--x\)"/)
  })
})

describe('subtract on React Native', () => {
  it('computes numbers and numeric strings', () => {
    expect(subtract(10, 3)).toBe(7)
    expect(subtract(10, '3px', 2)).toBe(5)
    expect(subtract(0, 5)).toBe(-5)
    expect(subtract(5)).toBe(5)
  })

  it('subtracts percentages when every operand is one', () => {
    expect(subtract('50%', '20%')).toBe('30%')
    expect(subtract('50%', 0)).toBe('50%')
    expect(subtract(0, '50%')).toBe('-50%')
  })

  it('throws for a mix and for what it cannot compute', () => {
    expect(() => subtract('50%', 4)).toThrow(/subtract\(\) cannot compute 4/)
    expect(() => subtract('var(--x)', 4)).toThrow(/subtract\(\) cannot compute "var\(--x\)"/)
  })
})

describe('the types', () => {
  it('is as narrow as the arguments', () => {
    expectTypeOf(multiply(8, 2)).toEqualTypeOf<number>()
    expectTypeOf(divide(8, 2)).toEqualTypeOf<number>()
    expectTypeOf(negate(8)).toEqualTypeOf<number>()
    expectTypeOf(add(1, 2)).toEqualTypeOf<number>()
    expectTypeOf(subtract(1, 2)).toEqualTypeOf<number>()
    expectTypeOf(multiply('50%', 2)).toEqualTypeOf<Percent>()
    expectTypeOf(add('50%', '10%')).toEqualTypeOf<Percent>()
    expectTypeOf(subtract('50%', '10%')).toEqualTypeOf<Percent>()
    expectTypeOf(negate('50%')).toEqualTypeOf<Percent>()
    expectTypeOf(divide('50%', 2)).toEqualTypeOf<Percent>()
    expectTypeOf(multiply('8px', 2)).toEqualTypeOf<number | Percent>()
    expectTypeOf(add('8px', 2)).toEqualTypeOf<number | Percent>()
  })
})
