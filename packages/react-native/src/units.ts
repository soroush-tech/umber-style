/** The base of `rem` when none is set: the font size that `1rem` is, in density-independent pixels. */
export const DEFAULT_REM_BASE = 16

/** A number with `px`, `rem`, `%` or no unit, once the white space around it is cut. */
const NUMBER_PATTERN = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(px|rem|%)?$/i

/** A number read from a string, and its unit: `''`, `'px'`, `'rem'` or `'%'`. */
export interface NumberReading {
  value: number
  unit: string
}

/** The number in `text` and its unit, or undefined when `text` is not a number with one of the units read here. */
export function readNumber(text: string): NumberReading | undefined {
  const match = NUMBER_PATTERN.exec(text.trim())
  if (match === null) return undefined
  return { value: Number.parseFloat(match[1]), unit: (match[2] ?? '').toLowerCase() }
}

/** The length in `text` as React Native takes it: a number, a number in `px`, or one in `rem` times `remBase`; undefined for anything else. */
export function toLength(text: string, remBase: number): number | undefined {
  const reading = readNumber(text)
  if (reading === undefined || reading.unit === '%') return undefined
  return reading.unit === 'rem' ? reading.value * remBase : reading.value
}

/**
 * The keys of the platform's view, text and image styles whose value type takes any number, apart from
 * the colours (a colour takes a number too): the ones that are lengths. A string with `px`, `rem` or no
 * unit becomes a number here. The type tests check this list and `NUMBER_KEYS` against the platform types.
 */
export const LENGTH_KEYS = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
  'inset',
  'insetBlock',
  'insetBlockEnd',
  'insetBlockStart',
  'insetInline',
  'insetInlineEnd',
  'insetInlineStart',
  'margin',
  'marginBlock',
  'marginBlockEnd',
  'marginBlockStart',
  'marginBottom',
  'marginEnd',
  'marginHorizontal',
  'marginInline',
  'marginInlineEnd',
  'marginInlineStart',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginTop',
  'marginVertical',
  'padding',
  'paddingBlock',
  'paddingBlockEnd',
  'paddingBlockStart',
  'paddingBottom',
  'paddingEnd',
  'paddingHorizontal',
  'paddingInline',
  'paddingInlineEnd',
  'paddingInlineStart',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingTop',
  'paddingVertical',
  'gap',
  'rowGap',
  'columnGap',
  'flexBasis',
  'borderWidth',
  'borderBottomWidth',
  'borderEndWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderStartWidth',
  'borderTopWidth',
  'borderRadius',
  'borderBottomEndRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderBottomStartRadius',
  'borderEndEndRadius',
  'borderEndStartRadius',
  'borderStartEndRadius',
  'borderStartStartRadius',
  'borderTopEndRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderTopStartRadius',
  'outlineOffset',
  'outlineWidth',
  'shadowRadius',
  'textShadowRadius',
  'elevation',
  'fontSize',
  'letterSpacing',
  'lineHeight',
] as const

/** The keys whose value type takes any number and that are not lengths: a string with no unit becomes a number here. */
export const NUMBER_KEYS = [
  'opacity',
  'shadowOpacity',
  'zIndex',
  'flex',
  'flexGrow',
  'flexShrink',
  'aspectRatio',
] as const

const lengthKeys = new Set<string>(LENGTH_KEYS)
const numberKeys = new Set<string>(NUMBER_KEYS)

/** The string `value` of `key` as React Native takes it: a number for a key that takes one and a value it can read, else `value` itself. */
function toNativeValue(key: string, value: string, remBase: number): string | number {
  if (lengthKeys.has(key)) return toLength(value, remBase) ?? value
  if (!numberKeys.has(key)) return value
  const reading = readNumber(value)
  return reading?.unit === '' ? reading.value : value
}

/** Turns, in place, the strings of `style` that are lengths or numbers into numbers (see `LENGTH_KEYS` and `NUMBER_KEYS`). */
export function convertValues(style: Record<string, unknown>, remBase: number): void {
  for (const key in style) {
    const value = style[key]
    if (typeof value === 'string') style[key] = toNativeValue(key, value, remBase)
  }
}
