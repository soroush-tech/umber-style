/** An easing as the web writes it, read: a name the animation library takes, a curve, or steps. */
export type EasingReading =
  | { readonly kind: 'named'; readonly name: string }
  | { readonly kind: 'cubic-bezier'; readonly points: readonly [number, number, number, number] }
  | { readonly kind: 'steps'; readonly count: number; readonly position: string }

/** The named easings of CSS, which the animation library takes as they are. */
const NAMED_EASINGS: ReadonlySet<string> = new Set([
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
])

/** The positions of `steps()`; `start` and `end` are `jump-start` and `jump-end`. */
const STEP_POSITIONS: ReadonlySet<string> = new Set([
  'jump-start',
  'jump-end',
  'jump-none',
  'jump-both',
  'start',
  'end',
])

/** The characters a CSS number is written with. */
const NUMBER_CHARACTERS: ReadonlySet<string> = new Set('0123456789.+-eE')

/** Whether `character` separates the words of a value: a space, a tab or a line break. */
function isSpace(character: string): boolean {
  return character === ' ' || character === '\t' || character === '\n' || character === '\r'
}

/**
 * `text` cut at each `separator` (one character, or white space for `' '`) that is outside parentheses,
 * each part trimmed, the empty ones left out: `a 1s cubic-bezier(0, 0, 1, 1)` is three words.
 */
function splitOutside(text: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const character of text) {
    if (character === '(') depth++
    if (character === ')') depth--
    const isCut = depth === 0 && (separator === ' ' ? isSpace(character) : character === separator)
    if (isCut) {
      parts.push(current.trim())
      current = ''
    } else current += character
  }
  parts.push(current.trim())
  return parts.filter((part) => part !== '')
}

/** The items of a comma list, outside parentheses: `opacity 1s, transform 2s` is two. */
export function splitList(text: string): string[] {
  return splitOutside(text, ',')
}

/** The words of one item, outside parentheses. */
export function splitWords(text: string): string[] {
  return splitOutside(text, ' ')
}

/** The number written in `text` as CSS writes one (`1`, `-0.5`, `.5`, `1e3`), or undefined. */
export function readCssNumber(text: string): number | undefined {
  if (text === '' || [...text].some((character) => !NUMBER_CHARACTERS.has(character))) {
    return undefined
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

/** A time in milliseconds: a number is milliseconds, text is a number with `s` or `ms` (any case); undefined for anything else. */
export function readTime(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const text = value.trim().toLowerCase()
  if (text.endsWith('ms')) return readCssNumber(text.slice(0, -2))
  if (!text.endsWith('s')) return undefined
  const seconds = readCssNumber(text.slice(0, -1))
  return seconds === undefined ? undefined : seconds * 1000
}

/** The arguments of `name(...)` in `text`, or undefined when `text` is not a call of `name`. */
function readArguments(text: string, name: string): string[] | undefined {
  if (!text.startsWith(`${name}(`) || !text.endsWith(')')) return undefined
  return text
    .slice(name.length + 1, -1)
    .split(',')
    .map((part) => part.trim())
}

/** `cubic-bezier(x1, y1, x2, y2)` read, with the x of both points from 0 to 1 as CSS requires. */
function readCurve(parts: readonly string[]): EasingReading | undefined {
  const numbers = parts.map(readCssNumber)
  if (numbers.length !== 4 || numbers.includes(undefined)) return undefined
  const [x1, y1, x2, y2] = numbers as [number, number, number, number]
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return undefined
  return { kind: 'cubic-bezier', points: [x1, y1, x2, y2] }
}

/** `steps(count, position)` read: a whole count of 1 or more (2 or more for `jump-none`), `end` when no position is given. */
function readSteps(parts: readonly string[]): EasingReading | undefined {
  const [first, position = 'end', ...rest] = parts
  const count = readCssNumber(first)
  const isCount = count !== undefined && Number.isInteger(count) && count >= 1
  if (!isCount || rest.length > 0 || !STEP_POSITIONS.has(position)) return undefined
  if (position === 'jump-none' && count < 2) return undefined
  return { kind: 'steps', count, position }
}

/** An easing written as the web writes it, read; undefined for text that is not a valid easing. */
export function readEasing(value: string): EasingReading | undefined {
  const text = value.trim().toLowerCase()
  if (NAMED_EASINGS.has(text)) return { kind: 'named', name: text }
  const curve = readArguments(text, 'cubic-bezier')
  if (curve !== undefined) return readCurve(curve)
  const steps = readArguments(text, 'steps')
  return steps === undefined ? undefined : readSteps(steps)
}

/** Whether `word` looks like an easing: a name, or a call of `cubic-bezier`, `steps` or `linear`. */
export function isEasingWord(word: string): boolean {
  const text = word.toLowerCase()
  return (
    NAMED_EASINGS.has(text) ||
    text.startsWith('cubic-bezier(') ||
    text.startsWith('steps(') ||
    text.startsWith('linear(')
  )
}

/** What the arguments of a transform function must be: their kind, and how many there may be. */
type TransformArguments = readonly ['length' | 'number' | 'angle', number, number]

/**
 * The transform functions the animation library reads in text, with their arguments, as its parser of
 * transforms reads them (`src/common/style/processors/transform.ts` of 4.7.1 and 4.8.0). `matrix` takes 6
 * or 16 numbers and is checked apart.
 */
const TRANSFORM_FUNCTIONS: Readonly<Record<string, TransformArguments>> = {
  translate: ['length', 1, 2],
  translateX: ['length', 1, 1],
  translateY: ['length', 1, 1],
  scale: ['number', 1, 2],
  scaleX: ['number', 1, 1],
  scaleY: ['number', 1, 1],
  rotate: ['angle', 1, 1],
  rotateX: ['angle', 1, 1],
  rotateY: ['angle', 1, 1],
  rotateZ: ['angle', 1, 1],
  skew: ['angle', 1, 2],
  skewX: ['angle', 1, 1],
  skewY: ['angle', 1, 1],
  perspective: ['number', 1, 1],
}

/** Whether `text` is a decimal as the library's checks write one: an optional `-`, digits, and an optional fraction. */
function isDecimal(text: string): boolean {
  const digits = text.startsWith('-') ? text.slice(1) : text
  const [whole, fraction, ...rest] = digits.split('.')
  const isDigits = (part: string) =>
    part !== '' && [...part].every((char) => char >= '0' && char <= '9')
  return rest.length === 0 && isDigits(whole) && (fraction === undefined || isDigits(fraction))
}

/** Whether `argument` is a number to the library: what `parseFloat` reads, not ending in an angle or `%`. */
function isTransformNumber(argument: string): boolean {
  const isUnitKept = ['deg', 'rad', '%'].some((unit) => argument.endsWith(unit))
  return !isUnitKept && !Number.isNaN(Number.parseFloat(argument))
}

/** Whether one argument of a transform function is of `kind`, as the library reads it. */
function isTransformArgument(argument: string, kind: TransformArguments[0]): boolean {
  if (kind === 'number') return isTransformNumber(argument)
  if (kind === 'length') {
    return (
      isTransformNumber(argument) || (argument.endsWith('%') && isDecimal(argument.slice(0, -1)))
    )
  }
  const isAngle = ['deg', 'rad'].some(
    (unit) => argument.endsWith(unit) && isDecimal(argument.slice(0, -unit.length))
  )
  return isAngle || (isTransformNumber(argument) && Number.parseFloat(argument) === 0)
}

/** Whether one function of a transform, `name(arguments` without its `)`, is one the library reads. */
function isTransformFunction(part: string): boolean {
  const open = part.indexOf('(')
  if (open === -1) return false
  const name = part.slice(0, open).trim()
  const values = part
    .slice(open + 1)
    .split(',')
    .map((value) => value.trim())
  if (name === 'matrix') {
    return (values.length === 6 || values.length === 16) && values.every(isTransformNumber)
  }
  const rule = TRANSFORM_FUNCTIONS[name]
  if (rule === undefined) return false
  const [kind, min, max] = rule
  const isCount = values.length >= min && values.length <= max
  return isCount && values.every((value) => isTransformArgument(value, kind))
}

/**
 * A transform written as text, as the animation library takes it: the text when the library reads every
 * function of it, no transform (`[]`) for `none`, which 4.7 does not read, and undefined for text the
 * library would reject (4.7 throws for it, 4.8 drops it with a warning of its own).
 */
export function readTransform(text: string): string | readonly [] | undefined {
  const value = text.trim()
  if (value === 'none') return []
  const parts = value
    .split(')')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  const isClosed = value.endsWith(')')
  return isClosed && parts.length > 0 && parts.every(isTransformFunction) ? value : undefined
}

/** A property written as CSS writes it, as the platform names it: `background-color` is `backgroundColor`. */
export function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}
