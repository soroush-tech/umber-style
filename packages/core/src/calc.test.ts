import { expectTypeOf } from 'vitest'
import {
  add,
  createCache,
  createEngine,
  createMemorySheet,
  divide,
  multiply,
  negate,
  subtract,
} from './index'
import type { Operand } from './index'

const space = 'var(--u-space-2)'
const gap = 'var(--u-gap)'

describe('multiply', () => {
  it('computes two numbers', () => {
    expect(multiply(8, 2)).toBe(16)
    expect(multiply(0.1, 3)).toBe(0.3)
    expect(multiply(0, -1)).toBe(0)
  })

  it('makes one calc of a string', () => {
    expect(multiply(space, 2)).toBe('calc(var(--u-space-2) * 2)')
    expect(multiply(space, -1.5)).toBe('calc(var(--u-space-2) * -1.5)')
  })

  it('computes a literal length of one unit', () => {
    expect(multiply('8px', 2)).toBe('16px')
    expect(multiply(' 1.5REM ', 2)).toBe('3rem')
    expect(multiply('50%', 0.5)).toBe('25%')
    expect(multiply('.5em', 3)).toBe('1.5em')
    expect(multiply('0.1px', 3)).toBe('0.3px')
  })

  it('falls back to a calc for anything that is not a plain number and unit', () => {
    expect(multiply('8', 2)).toBe('calc(8 * 2)')
    expect(multiply('1px 2px', 2)).toBe('calc(1px 2px * 2)')
    expect(multiply('10px + 1em', 2)).toBe('calc(10px + 1em * 2)')
  })

  it('wraps an operand that is a calc in parentheses, never calc(calc())', () => {
    expect(multiply(multiply(space, 2), 3)).toBe('calc((var(--u-space-2) * 2) * 3)')
    expect(multiply('calc(1px + var(--a))', 2)).toBe('calc((1px + var(--a)) * 2)')
  })

  it('does not unwrap two calcs that only touch', () => {
    expect(multiply('calc(1px + var(--a)) + calc(2px + var(--b))', 2)).toBe(
      'calc(calc(1px + var(--a)) + calc(2px + var(--b)) * 2)'
    )
    expect(multiply('calc(var(--a)) + 1px', 2)).toBe('calc(calc(var(--a)) + 1px * 2)')
  })

  it('returns the input for 1 and 0 for 0', () => {
    expect(multiply(space, 1)).toBe(space)
    expect(multiply(4, 1)).toBe(4)
    expect(multiply(space, 0)).toBe(0)
    expect(multiply('8px', 0)).toBe(0)
  })

  it('throws on a factor that is not finite, and on the wrong types', () => {
    expect(() => multiply(space, Number.NaN)).toThrow(RangeError)
    expect(() => multiply(space, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => multiply(Number.NaN, 2)).toThrow(RangeError)
    expect(() => multiply(space, '2' as unknown as number)).toThrow(TypeError)
    expect(() => multiply(undefined as unknown as string, 2)).toThrow(TypeError)
    expect(() => multiply(space, Number.NaN)).toThrow(/multiply\(\): the factor/)
  })
})

describe('divide', () => {
  it('computes two numbers', () => {
    expect(divide(8, 2)).toBe(4)
    expect(divide(8, 3)).toBe(2.666667)
  })

  it('makes one calc of a string, and computes a literal length', () => {
    expect(divide(space, 2)).toBe('calc(var(--u-space-2) / 2)')
    expect(divide('9px', 3)).toBe('3px')
    expect(divide(multiply(space, 3), 2)).toBe('calc((var(--u-space-2) * 3) / 2)')
  })

  it('returns the input for 1', () => {
    expect(divide(space, 1)).toBe(space)
  })

  it('throws a RangeError for 0 and for a divisor that is not finite', () => {
    expect(() => divide(space, 0)).toThrow(RangeError)
    expect(() => divide(8, 0)).toThrow(/divide\(\): the divisor must not be 0/)
    expect(() => divide(space, Number.NaN)).toThrow(/the divisor must be finite/)
  })
})

describe('negate', () => {
  it('is multiply by -1', () => {
    expect(negate(space)).toBe('calc(var(--u-space-2) * -1)')
    expect(negate(8)).toBe(-8)
    expect(negate('8px')).toBe('-8px')
    expect(negate(negate(space))).toBe('calc((var(--u-space-2) * -1) * -1)')
  })

  it('names itself in an error', () => {
    expect(() => negate(Number.NaN)).toThrow(/negate\(\): a value must be finite/)
  })
})

describe('add', () => {
  it('computes numbers', () => {
    expect(add(4, 4)).toBe(8)
    expect(add(0.1, 0.2)).toBe(0.3)
    expect(add(1, 2, 3)).toBe(6)
  })

  it('treats a number next to a string as a length in px', () => {
    expect(add(space, 4)).toBe('calc(var(--u-space-2) + 4px)')
    expect(add(4, space)).toBe('calc(4px + var(--u-space-2))')
    expect(add(space, -4)).toBe('calc(var(--u-space-2) + -4px)')
    expect(add(space, gap, 2)).toBe('calc(var(--u-space-2) + var(--u-gap) + 2px)')
  })

  it('unwraps an operand that is a calc into parentheses', () => {
    expect(add(multiply(space, 2), gap)).toBe('calc((var(--u-space-2) * 2) + var(--u-gap))')
  })

  it('computes literal lengths of one unit', () => {
    expect(add('8px', '4px')).toBe('12px')
    expect(add('8px', 4)).toBe('12px')
    expect(add('1rem', '0.5rem', '0.25rem')).toBe('1.75rem')
  })

  it('falls back to a calc for mixed units or a non-literal', () => {
    expect(add('8px', '1em')).toBe('calc(8px + 1em)')
    expect(add('8px', '4')).toBe('calc(8px + 4)')
    expect(add('1em', 4)).toBe('calc(1em + 4px)')
    expect(add('8px', space)).toBe('calc(8px + var(--u-space-2))')
    expect(add(space, '8px')).toBe('calc(var(--u-space-2) + 8px)')
  })

  it('returns the input for one operand and for zeros', () => {
    expect(add(space)).toBe(space)
    expect(add(space, 0)).toBe(space)
    expect(add(0, space, 0)).toBe(space)
    expect(add(0, 0)).toBe(0)
    expect(add()).toBe(0)
  })

  it('throws on a value that is not finite or not a string or number', () => {
    expect(() => add(space, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => add(space, null as unknown as string)).toThrow(/add\(\): a value must be a number/)
  })
})

describe('subtract', () => {
  it('computes numbers', () => {
    expect(subtract(10, 3)).toBe(7)
    expect(subtract(10, 3, 2)).toBe(5)
    expect(subtract(0, 5)).toBe(-5)
  })

  it('makes one calc, with numbers as px', () => {
    expect(subtract(space, 4)).toBe('calc(var(--u-space-2) - 4px)')
    expect(subtract(space, gap, 2)).toBe('calc(var(--u-space-2) - var(--u-gap) - 2px)')
    expect(subtract(space, -4)).toBe('calc(var(--u-space-2) - -4px)')
    expect(subtract(0, space)).toBe('calc(0px - var(--u-space-2))')
  })

  it('puts a calc operand in parentheses', () => {
    expect(subtract(space, add(gap, 4))).toBe('calc(var(--u-space-2) - (var(--u-gap) + 4px))')
  })

  it('computes literal lengths of one unit', () => {
    expect(subtract('8px', '3px')).toBe('5px')
    expect(subtract('8px', 3)).toBe('5px')
    expect(subtract('8px', '1em')).toBe('calc(8px - 1em)')
  })

  it('returns the input for nothing and for zeros', () => {
    expect(subtract(space)).toBe(space)
    expect(subtract(space, 0)).toBe(space)
    expect(subtract(space, 0, 0)).toBe(space)
  })

  it('throws on a value that is not finite or not a string or number', () => {
    expect(() => subtract(Number.NaN)).toThrow(/subtract\(\): a value must be finite/)
    expect(() => subtract(space, {} as unknown as string)).toThrow(TypeError)
  })
})

describe('the types', () => {
  it('is a number for numbers, and a string or number otherwise', () => {
    expectTypeOf(multiply(8, 2)).toEqualTypeOf<number>()
    expectTypeOf(divide(8, 2)).toEqualTypeOf<number>()
    expectTypeOf(negate(8)).toEqualTypeOf<number>()
    expectTypeOf(add(1, 2)).toEqualTypeOf<number>()
    expectTypeOf(subtract(1, 2)).toEqualTypeOf<number>()
    expectTypeOf(multiply(space, 2)).toEqualTypeOf<Operand>()
    expectTypeOf(add(space, 2)).toEqualTypeOf<Operand>()
    expectTypeOf(subtract(space, 2)).toEqualTypeOf<Operand>()
    expectTypeOf(negate(space)).toEqualTypeOf<Operand>()
    expectTypeOf(divide(space, 2)).toEqualTypeOf<Operand>()
  })
})

describe('a style that uses them', () => {
  it('serializes to valid CSS text', () => {
    const sheet = createMemorySheet()
    const engine = createEngine(
      { space: [0, 4, 8] },
      { prefix: 'u', cache: createCache({ prefix: 'u', sheet }) }
    )
    const className = engine.css({
      marginLeft: negate(engine.refs.space[2]),
      padding: multiply(engine.refs.space[1], 2),
      width: add(engine.refs.space[2], 4),
      opacity: multiply(0.5, 1),
      '&:hover': { margin: subtract(engine.refs.space[2], 2) },
    })
    expect(sheet.rules).toEqual([
      `.${className}{margin-left:calc(var(--u-space-2) * -1);padding:calc(var(--u-space-1) * 2);width:calc(var(--u-space-2) + 4px);opacity:0.5;}`,
      `.${className}:hover{margin:calc(var(--u-space-2) - 2px);}`,
    ])
  })
})
