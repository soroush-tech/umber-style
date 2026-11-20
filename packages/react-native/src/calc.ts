import { readNumber } from './units'

/** What arithmetic on tokens takes on React Native: a number, a numeric string, or a percentage string. */
export type Operand = string | number

/** A percentage, as the platform takes it: `'50%'`. */
export type Percent = `${number}%`

/** One operand of a sum, with the sign it has. */
interface Term {
  operand: Operand
  sign: 1 | -1
}

/** An operand that is read: its number, and whether it is a percentage. */
interface Reading {
  value: number
  isPercent: boolean
}

/** `value` rounded so that float noise (0.1 * 3) does not show; `-0` is `0`. */
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6 + 0
}

/** The error for a `value` that React Native cannot compute: the helper and the value are in the message. */
function unsupported(name: string, value: unknown): TypeError {
  return new TypeError(
    `@umber-style/react-native: ${name}() cannot compute ${JSON.stringify(value)}; it takes a number, a numeric string ("8", "8px") or a percentage ("50%"), and a percentage cannot be mixed with a number`
  )
}

/** Throws unless `value` is a finite number. */
function assertFinite(name: string, what: string, value: unknown): asserts value is number {
  if (typeof value !== 'number') {
    throw new TypeError(
      `@umber-style/react-native: ${name}(): ${what} must be a number, got ${typeof value}`
    )
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(
      `@umber-style/react-native: ${name}(): ${what} must be finite, got ${value}`
    )
  }
}

/**
 * The number of `operand`, and whether it is a percentage; anything else cannot be computed. A string is
 * read as a style value is converted (`readNumber`), but `rem` is refused: a helper has no base for it.
 */
function read(name: string, operand: unknown): Reading {
  if (typeof operand !== 'string') {
    assertFinite(name, 'a value', operand)
    return { value: operand, isPercent: false }
  }
  const reading = readNumber(operand)
  if (reading === undefined || reading.unit === 'rem') throw unsupported(name, operand)
  return { value: reading.value, isPercent: reading.unit === '%' }
}

/** `value` as the percentage that a style takes. */
function toPercent(value: number): Percent {
  return `${tidy(value)}%`
}

/** `operand` multiplied or divided by `factor`; a percentage stays a percentage. */
function scale(
  name: string,
  operand: Operand,
  factor: number,
  isDivision: boolean
): number | Percent {
  const { value, isPercent } = read(name, operand)
  assertFinite(name, isDivision ? 'the divisor' : 'the factor', factor)
  if (isDivision && factor === 0) {
    throw new RangeError(`@umber-style/react-native: ${name}(): the divisor must not be 0`)
  }
  const result = isDivision ? value / factor : value * factor
  return isPercent ? toPercent(result) : tidy(result)
}

/** The sum of `terms`: all numbers, or all percentages (a number 0 is both). */
function sum(name: string, terms: readonly Term[]): number | Percent {
  const readings = terms.map(({ operand, sign }) => ({ operand, sign, ...read(name, operand) }))
  const isPercent = readings.some((reading) => reading.isPercent)
  let total = 0
  for (const { operand, sign, value, isPercent: isPercentValue } of readings) {
    if (isPercentValue !== isPercent && operand !== 0) throw unsupported(name, operand)
    total += sign * value
  }
  return isPercent ? toPercent(total) : tidy(total)
}

/** `value` times `factor`: a number for a number, a percentage for a percentage. */
export function multiply(value: number, factor: number): number
export function multiply(value: Percent, factor: number): Percent
export function multiply(value: Operand, factor: number): number | Percent
export function multiply(value: Operand, factor: number): number | Percent {
  return scale('multiply', value, factor, false)
}

/** `value` divided by `divisor`; a `divisor` of 0 throws a `RangeError`. */
export function divide(value: number, divisor: number): number
export function divide(value: Percent, divisor: number): Percent
export function divide(value: Operand, divisor: number): number | Percent
export function divide(value: Operand, divisor: number): number | Percent {
  return scale('divide', value, divisor, true)
}

/** The sum of `values`: all numbers, or all percentages. */
export function add(...values: number[]): number
export function add(...values: Percent[]): Percent
export function add(...values: Operand[]): number | Percent
export function add(...values: Operand[]): number | Percent {
  return sum(
    'add',
    values.map((operand) => ({ operand, sign: 1 as const }))
  )
}

/** `value` minus each of `values`: all numbers, or all percentages. */
export function subtract(value: number, ...values: number[]): number
export function subtract(value: Percent, ...values: Percent[]): Percent
export function subtract(value: Operand, ...values: Operand[]): number | Percent
export function subtract(value: Operand, ...values: Operand[]): number | Percent {
  return sum('subtract', [
    { operand: value, sign: 1 },
    ...values.map((operand) => ({ operand, sign: -1 as const })),
  ])
}

/** `value` times -1: a negative margin from a token. */
export function negate(value: number): number
export function negate(value: Percent): Percent
export function negate(value: Operand): number | Percent
export function negate(value: Operand): number | Percent {
  return scale('negate', value, -1, false)
}
