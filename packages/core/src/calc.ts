/** A value of arithmetic on tokens: a CSS value (a reference such as `var(--space-2)`, a length) or a number. */
export type Operand = string | number

/** A literal length: a number and its unit. */
interface Length {
  value: number
  unit: string
}

/** One operand of a sum, with the sign it has. */
interface Term {
  operand: Operand
  sign: 1 | -1
}

const LENGTH_PATTERN = /^(-?(?:\d+\.?\d*|\.\d+))([a-z]+|%)$/i
const CALC_PREFIX = 'calc('

/** `value` rounded so that float noise (0.1 * 3) does not reach the CSS; `-0` is `0`. */
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6 + 0
}

/** Throws unless `value` is a finite number; `what` names the argument in the message. */
function assertFinite(name: string, what: string, value: unknown): asserts value is number {
  if (typeof value !== 'number') {
    throw new TypeError(`${name}(): ${what} must be a number, got ${typeof value}`)
  }
  if (!Number.isFinite(value))
    throw new RangeError(`${name}(): ${what} must be finite, got ${value}`)
}

/** Throws unless `value` is a string or a finite number. */
function assertOperand(name: string, value: unknown): asserts value is Operand {
  if (typeof value !== 'string') assertFinite(name, 'a value', value)
}

/** The inside of `value` when the whole of it is one `calc(...)`, else undefined. */
function unwrapCalc(value: string): string | undefined {
  if (!value.startsWith(CALC_PREFIX) || !value.endsWith(')')) return undefined
  let depth = 0
  for (let index = CALC_PREFIX.length - 1; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1
    if (value[index] === ')') depth -= 1
    // The first parenthesis closes before the end: `calc(a) + calc(b)` is not one calc.
    if (depth === 0 && index < value.length - 1) return undefined
  }
  return value.slice(CALC_PREFIX.length, -1)
}

/** `operand` as a part of a calc expression: a number is a length in px, an inner calc gets parentheses. */
function toTerm(operand: Operand): string {
  if (typeof operand === 'number') return `${tidy(operand)}px`
  const inner = unwrapCalc(operand)
  return inner === undefined ? operand : `(${inner})`
}

/** `operand` as a literal length (a number is in px), or undefined when it is not one. */
function toLength(operand: Operand): Length | undefined {
  if (typeof operand === 'number') return { value: operand, unit: 'px' }
  const match = LENGTH_PATTERN.exec(operand.trim())
  return match ? { value: Number.parseFloat(match[1]), unit: match[2].toLowerCase() } : undefined
}

type Operator = '*' | '/'

const OPERATIONS: Record<Operator, (value: number, factor: number) => number> = {
  '*': (value, factor) => value * factor,
  '/': (value, factor) => value / factor,
}

/** `value` multiplied or divided by `factor`, as a number, a literal length or a calc. */
function scale(name: string, value: Operand, factor: number, operator: Operator): Operand {
  assertOperand(name, value)
  assertFinite(name, operator === '*' ? 'the factor' : 'the divisor', factor)
  if (factor === 0) {
    if (operator === '/') throw new RangeError(`${name}(): the divisor must not be 0`)
    return 0
  }
  if (factor === 1) return value
  if (typeof value === 'number') return tidy(OPERATIONS[operator](value, factor))
  const length = toLength(value)
  return length === undefined
    ? `${CALC_PREFIX}${toTerm(value)} ${operator} ${factor})`
    : `${tidy(OPERATIONS[operator](length.value, factor))}${length.unit}`
}

/** The sum of `terms` when they are all numbers, else undefined. */
function sumNumbers(terms: Term[]): number | undefined {
  let total = 0
  for (const { operand, sign } of terms) {
    if (typeof operand !== 'number') return undefined
    total += sign * operand
  }
  return tidy(total)
}

/** The sum of `terms` when they are literal lengths of one unit, else undefined. */
function sumLengths(terms: Term[]): string | undefined {
  const lengths = terms.map(({ operand }) => toLength(operand))
  const unit = lengths[0]?.unit
  let total = 0
  for (const [index, length] of lengths.entries()) {
    if (length === undefined || length.unit !== unit) return undefined
    total += terms[index].sign * length.value
  }
  return `${tidy(total)}${unit}`
}

/** `terms` as one calc: the first term, then each with its sign. */
function toCalc(terms: Term[]): string {
  const body = terms
    .map(({ operand, sign }, index) => {
      const term = toTerm(operand)
      return index === 0 ? term : `${sign === 1 ? '+' : '-'} ${term}`
    })
    .join(' ')
  return `${CALC_PREFIX}${body})`
}

/** `terms` added and subtracted, as a number, a literal length or one calc. */
function sum(terms: Term[]): Operand {
  if (terms.length === 1) return terms[0].operand
  return sumNumbers(terms) ?? sumLengths(terms) ?? toCalc(terms)
}

/** The terms of `values` with `sign`, without the zeros that change nothing; each is checked. */
function toTerms(name: string, values: readonly Operand[], sign: 1 | -1): Term[] {
  for (const value of values) assertOperand(name, value)
  return values.filter((value) => value !== 0).map((operand) => ({ operand, sign }))
}

/** `value` times `factor`: a number for numbers, otherwise a CSS value that the browser computes. */
export function multiply(value: number, factor: number): number
export function multiply(value: Operand, factor: number): Operand
export function multiply(value: Operand, factor: number): Operand {
  return scale('multiply', value, factor, '*')
}

/** `value` divided by `divisor`; a `divisor` of 0 throws a `RangeError`. */
export function divide(value: number, divisor: number): number
export function divide(value: Operand, divisor: number): Operand
export function divide(value: Operand, divisor: number): Operand {
  return scale('divide', value, divisor, '/')
}

/** The sum of `values`; a number next to a string is a length in px. */
export function add(...values: number[]): number
export function add(...values: Operand[]): Operand
export function add(...values: Operand[]): Operand {
  const terms = toTerms('add', values, 1)
  return terms.length === 0 ? 0 : sum(terms)
}

/** `value` minus each of `values`; a number next to a string is a length in px. */
export function subtract(value: number, ...values: number[]): number
export function subtract(value: Operand, ...values: Operand[]): Operand
export function subtract(value: Operand, ...values: Operand[]): Operand {
  assertOperand('subtract', value)
  return sum([{ operand: value, sign: 1 }, ...toTerms('subtract', values, -1)])
}

/** `value` times -1: a negative margin from a token. */
export function negate(value: number): number
export function negate(value: Operand): Operand
export function negate(value: Operand): Operand {
  return scale('negate', value, -1, '*')
}
