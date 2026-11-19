/** A length or `auto`: one value of a CSS shorthand. */
const SHORTHAND_ITEM = String.raw`(?:-?(?:\d+(?:\.\d*)?|\.\d+)(?:%|[a-z]*)|auto)`
const SHORTHAND = new RegExp(String.raw`^\s*${SHORTHAND_ITEM}(?:\s+${SHORTHAND_ITEM}){1,3}\s*$`)
/** A number and a unit, once the white space around them is cut. */
const UNIT_VALUE = /^-?(?:\d+(?:\.\d*)?|\.\d+)([a-z]+)$/i
/** The CSS length units, other than a percentage, that React Native does not take. */
const CSS_UNITS = new Set([
  'px',
  'em',
  'rem',
  'ex',
  'ch',
  'vh',
  'vw',
  'vmin',
  'vmax',
  'pt',
  'pc',
  'cm',
  'mm',
  'in',
  'q',
])

/** Whether `value` is a number with a CSS length unit other than a percentage. */
function hasCssUnit(value: string): boolean {
  const match = UNIT_VALUE.exec(value.trim())
  return match !== null && CSS_UNITS.has(match[1].toLowerCase())
}

const warned = new Set<string>()

/** Whether this is a development build: `process` may not exist, and then nothing is warned. */
function isDevelopment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
}

/** What is wrong with the string `value` of `key` on React Native, or undefined when nothing is. */
function describeProblem(key: string, value: string): string | undefined {
  if (SHORTHAND.test(value)) {
    return `"${key}: ${value}" is a shorthand with several values; React Native takes one value for each key. Set each side or axis on its own.`
  }
  if (hasCssUnit(value)) {
    return `"${key}: ${value}" has a CSS unit; React Native takes a number (density-independent pixels) or a percentage.`
  }
  return undefined
}

/**
 * In development, warns (once for each distinct message) about the values that the types cannot reject:
 * a shorthand string with several values, or a number with a CSS unit.
 */
export function warnAboutValues(style: Record<string, unknown>): void {
  if (!isDevelopment()) return
  for (const [key, value] of Object.entries(style)) {
    const message = typeof value === 'string' ? describeProblem(key, value) : undefined
    if (message === undefined || warned.has(message)) continue
    warned.add(message)
    console.warn(`@umber-style/react-native: ${message}`)
  }
}
