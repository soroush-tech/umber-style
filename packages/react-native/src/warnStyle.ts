import { readCondition, readState } from '@umber-style/core'
import { isMediaKey, readMediaQuery } from './mediaQuery'

/** A length or `auto`: one value of a CSS shorthand. */
const SHORTHAND_ITEM = String.raw`(?:-?(?:\d+(?:\.\d*)?|\.\d+)(?:%|[a-z]*)|auto)`
const SHORTHAND = new RegExp(String.raw`^\s*${SHORTHAND_ITEM}(?:\s+${SHORTHAND_ITEM}){1,3}\s*$`)
/** A number and a unit, once the white space around them is cut. */
const UNIT_VALUE = /^-?(?:\d+(?:\.\d*)?|\.\d+)([a-z]+)$/i
/** The CSS length units, other than a percentage, `em` and the viewport units, that React Native does not take. */
const CSS_UNITS = new Set(['px', 'rem', 'ex', 'ch', 'pt', 'pc', 'cm', 'mm', 'in', 'q'])
/** The viewport units: `vh`, `vw`, `vmin`, `vmax`, `vi`, `vb`, and their small, large and dynamic forms (`dvh`). */
const VIEWPORT_UNIT = /^[sld]?v(?:h|w|i|b|min|max)$/
const CALC = /calc\(/i
const CURRENT_COLOR = /currentcolor/i
const ANIMATION_KEY = /^(?:animation|transition)/

const warned = new Set<string>()

/** Whether this is a development build: `process` may not exist, and then nothing is warned. */
function isDevelopment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
}

/** Warns `message` once, with the name of the component (or sheet entry) in front when it is known. */
function warnOnce(message: string, name: string | undefined): void {
  const text = name === undefined ? message : `${name}: ${message}`
  if (warned.has(text)) return
  warned.add(text)
  console.warn(`@umber-style/react-native: ${text}`)
}

/** What is wrong with the CSS unit `unit` of `key: value`, or undefined when it is not a CSS unit. */
function describeUnit(key: string, value: string, unit: string): string | undefined {
  if (unit === 'em') {
    return `"${key}: ${value}" is in em, which has no equivalent on React Native (a style does not know the font size around it); it is passed as it is. Write a number, or a length in rem.`
  }
  if (VIEWPORT_UNIT.test(unit)) {
    return `"${key}: ${value}" is in a viewport unit, which has no equivalent in a React Native style; it is passed as it is. Write a percentage, or a number computed from the window size.`
  }
  if (CSS_UNITS.has(unit)) {
    return `"${key}: ${value}" has a CSS unit; React Native takes a number (density-independent pixels) or a percentage.`
  }
  return undefined
}

/** What is wrong with the string `value` of `key` on React Native, or undefined when nothing is. */
function describeProblem(key: string, value: string): string | undefined {
  if (SHORTHAND.test(value)) {
    return `"${key}: ${value}" is a shorthand with several values; React Native takes one value for each key. Set each side or axis on its own.`
  }
  if (CALC.test(value)) {
    return `"${key}: ${value}" is a calc() expression, which React Native does not compute; it is passed as it is. Use add, subtract, multiply and divide, which return numbers.`
  }
  if (CURRENT_COLOR.test(value)) {
    return `"${key}: ${value}" uses currentColor, which React Native does not have; it is passed as it is. Give the colour itself.`
  }
  const match = UNIT_VALUE.exec(value.trim())
  return match === null ? undefined : describeUnit(key, value, match[1].toLowerCase())
}

/**
 * In development, warns (once for each distinct message) about the values that the types cannot reject
 * and that were not converted: a shorthand string with several values, a number with a CSS unit (`em`
 * and the viewport units have no equivalent), a `calc()` expression, and `currentColor`. `name` is the
 * component or sheet entry the style belongs to, when it is known.
 */
export function warnAboutValues(style: Record<string, unknown>, name?: string): void {
  if (!isDevelopment()) return
  for (const [key, value] of Object.entries(style)) {
    const message = typeof value === 'string' ? describeProblem(key, value) : undefined
    if (message !== undefined) warnOnce(message, name)
  }
}

/** Why the web-only key `key` is dropped, or undefined when dropping it is not a mistake (`label`, a condition or state key, a media query that is evaluated). */
function describeDropped(key: string): string | undefined {
  if (key === 'label' || readCondition(key) !== undefined || readState(key) !== undefined) {
    return undefined
  }
  if (isMediaKey(key)) {
    const { problem } = readMediaQuery(key)
    return problem === undefined ? undefined : `React Native does not evaluate ${problem}`
  }
  if (key.startsWith('@')) return 'React Native has no at-rules'
  if (key.startsWith('--')) return 'React Native has no custom properties'
  if (ANIMATION_KEY.test(key)) return 'animations do not run on React Native yet'
  return 'React Native has no selectors'
}

/**
 * In development, warns (once for each distinct message) that the web-only key `key`, written outside
 * the `web` part of a style, is dropped: a selector, an at-rule, a custom property, or an `animation*` or
 * `transition*` key, or a media query with something the binding does not evaluate. `label`, a `when()`,
 * `whenScheme()` or `state()` key that does not match, and a media query that does not match are not
 * mistakes.
 */
export function warnAboutDroppedKey(key: string, name: string | undefined): void {
  if (!isDevelopment()) return
  const reason = describeDropped(key)
  if (reason === undefined) return
  warnOnce(
    `"${key}" is dropped: ${reason}. A key for the web only goes in the web part of a shared style.`,
    name
  )
}

/** What the state `name` is learned from, when the component keeps it. */
const HELD_EVENTS = { hovered: 'onHoverIn and onHoverOut', focused: 'onFocus and onBlur' }

/**
 * In development, warns (once for each component and state) that a function style names `hovered` or
 * `focused` while no object style of the component does: the component was made without the state it
 * would keep, so the state follows the prop of that name alone.
 */
export function warnAboutUnheldState(
  name: 'hovered' | 'focused',
  component: string | undefined
): void {
  if (!isDevelopment()) return
  warnOnce(
    `state('${name}') is named in a function style only, so the component keeps no ${name} state and follows the ${name} prop alone. Name it in an object style of the component as well (an empty part is enough) for the binding to follow ${HELD_EVENTS[name]}.`,
    component
  )
}

/** In development, warns (once for each query) that `useMediaQuery(query)` is always false: the binding does not evaluate `problem` in it. */
export function warnAboutQuery(query: string, problem: string): void {
  if (!isDevelopment()) return
  warnOnce(
    `useMediaQuery("${query}") is false: React Native does not evaluate ${problem}.`,
    undefined
  )
}

/** The options of `createStyle` and `configure` that React Native uses; every other option is for the web. */
const NATIVE_OPTIONS = new Set(['theme', 'remBase', 'lengthKeys'])

/** In development, warns (once) about the options of `createStyle` or `configure` that React Native does not use, by name. */
export function warnAboutIgnoredOptions(options: object): void {
  if (!isDevelopment()) return
  const ignored = Object.entries(options)
    .filter(([name, value]) => value !== undefined && !NATIVE_OPTIONS.has(name))
    .map(([name]) => name)
  if (ignored.length === 0) return
  warnOnce(
    `the options ${ignored.join(', ')} are for the web, and React Native does not use them: they are ignored. Only theme, remBase and lengthKeys are read.`,
    undefined
  )
}
