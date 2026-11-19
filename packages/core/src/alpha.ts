const BRAND = Symbol.for('umber-style.alpha-color')

/**
 * The result of `alpha()` for a colour that is neither fully opaque nor fully transparent. The
 * serializer writes it as two declarations when it is the whole value of a property: `fallback` first,
 * then `value`. As text (`String(x)`, a template literal) it is `value` alone.
 */
export interface AlphaColor {
  /** The colour at the opacity as rgba() when the colour is a literal the engine can read, else the colour itself. */
  readonly fallback: string
  /** The color-mix() value. */
  readonly value: string
}

/** The red, green and blue channels (0 to 255) and the opacity (0 to 1) of a colour literal. */
interface Rgba {
  red: number
  green: number
  blue: number
  opacity: number
}

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`
const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNCTION_PATTERNS = [
  new RegExp(
    String.raw`^rgba?\(\s*(${NUMBER})\s*,\s*(${NUMBER})\s*,\s*(${NUMBER})\s*(?:,\s*(${NUMBER}%?)\s*)?\)$`,
    'i'
  ),
  new RegExp(
    String.raw`^rgba?\(\s*(${NUMBER})\s+(${NUMBER})\s+(${NUMBER})\s*(?:/\s*(${NUMBER}%?)\s*)?\)$`,
    'i'
  ),
]

/** Whether `value` was made by `alpha()` as a mix: a plain string is a color, not a fallback pair. */
export function isAlphaColor(value: unknown): value is AlphaColor {
  return typeof value === 'object' && value !== null && BRAND in value
}

/** `value` limited to `low` through `high`. */
function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** `value` with four decimals at most, so that float noise (0.1 * 3) does not reach the CSS. */
function round(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

/** The channels of `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, or undefined for another string. */
function readHex(color: string): Rgba | undefined {
  if (!HEX_PATTERN.test(color)) return undefined
  const digits = color.slice(1)
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits
  const [red, green, blue, opacity = 255] = [0, 2, 4, 6]
    .slice(0, full.length / 2)
    .map((start) => Number.parseInt(full.slice(start, start + 2), 16))
  return { red, green, blue, opacity: opacity / 255 }
}

/** The channels of `rgb()` or `rgba()` with numbers (comma or space syntax), or undefined for another string. */
function readFunction(color: string): Rgba | undefined {
  for (const pattern of FUNCTION_PATTERNS) {
    const match = pattern.exec(color)
    if (match === null) continue
    const [red, green, blue] = [1, 2, 3].map((index) =>
      Math.round(clamp(Number.parseFloat(match[index]), 0, 255))
    )
    const given = match[4] ?? '1'
    const opacity = given.endsWith('%') ? Number.parseFloat(given) / 100 : Number.parseFloat(given)
    return { red, green, blue, opacity: clamp(opacity, 0, 1) }
  }
  return undefined
}

/**
 * `color` at `opacity` as `rgba(r, g, b, a)`, when `color` is a literal that can be read (`#rgb`, `#rgba`,
 * `#rrggbb`, `#rrggbbaa`, `rgb()` or `rgba()` with numbers; its own alpha is multiplied), else undefined.
 */
export function toRgba(color: string, opacity: number): string | undefined {
  const channels = readHex(color.trim()) ?? readFunction(color.trim())
  if (channels === undefined) return undefined
  const { red, green, blue } = channels
  return `rgba(${red}, ${green}, ${blue}, ${round(channels.opacity * opacity)})`
}

/** Throws what `alpha()` throws: a `TypeError` for a color that is not a string or an opacity that is not a number, a `RangeError` for an opacity outside 0 to 1 or NaN. */
export function assertAlphaInput(color: unknown, opacity: unknown): void {
  if (typeof color !== 'string') {
    throw new TypeError(`alpha(): the color must be a string, got ${typeof color}`)
  }
  if (typeof opacity !== 'number') {
    throw new TypeError(`alpha(): the opacity must be a number, got ${typeof opacity}`)
  }
  if (!(opacity >= 0 && opacity <= 1)) {
    throw new RangeError(`alpha(): the opacity must be from 0 to 1, got ${opacity}`)
  }
}

/**
 * `color` at `opacity` (0 to 1). Between 0 and 1 the result is an `AlphaColor`: written as a fallback
 * (`rgba()` for a literal colour, else the colour itself) followed by `color-mix(in srgb, <color> <n>%,
 * transparent)`, which works with var(--x) colors. 1 returns `color` and 0 returns `transparent`. A
 * fallback is only written when the result is the whole value of a property; in a longer string
 * (`1px solid ${alpha(c, 0.5)}`) it is the color-mix() form alone. Throws a `TypeError` for a color
 * that is not a string or an opacity that is not a number, a `RangeError` for an opacity outside 0 to 1.
 */
export function alpha(color: string, opacity: number): AlphaColor | string {
  assertAlphaInput(color, opacity)
  if (opacity === 1) return color
  if (opacity === 0) return 'transparent'
  const percent = Math.round(opacity * 10000) / 100
  const value = `color-mix(in srgb, ${color} ${percent}%, transparent)`
  const mix = {}
  Object.defineProperties(mix, {
    fallback: { value: toRgba(color, opacity) ?? color, enumerable: true },
    value: { value, enumerable: true },
    toString: { value: () => value },
    [BRAND]: { value: true },
  })
  return Object.freeze(mix) as AlphaColor
}
