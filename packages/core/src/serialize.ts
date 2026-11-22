import { alpha, isAlphaColor, type AlphaColor } from './alpha'
import { negate } from './calc'
import { codeAt } from './codeAt'
import {
  createNoSchemeGuard,
  createScopeRule,
  DEFAULT_SCOPING,
  getBoundaryClass,
  getSchemeClass,
  readCondition,
  type Condition,
  type Scoping,
} from './scope'
import { PREFIXED_FORMS, type PrefixedForm } from './vendorPrefixes'

/** The value of a key of a style: a CSS value, a falsy value that is left out, a list of values (one declaration each, in order), or a nested style. */
export type StyleValue =
  | string
  | number
  | AlphaColor
  | null
  | undefined
  | false
  | readonly (string | number | AlphaColor)[]
  | StyleObject

/** A style the serializer reads: CSS properties in camelCase or as written, selectors and at-rules, each to its value. */
export interface StyleObject {
  [key: string]: StyleValue
}

const UNITLESS = new Set([
  'animationIterationCount',
  'aspectRatio',
  'columnCount',
  'columns',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'gridArea',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnStart',
  'gridRow',
  'gridRowEnd',
  'gridRowStart',
  'initialLetter',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
  'fillOpacity',
  'floodOpacity',
  'stopOpacity',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
])

/** The properties whose value is a time: a number is in milliseconds. */
const TIMES = new Set([
  'animationDelay',
  'animationDuration',
  'transitionDelay',
  'transitionDuration',
])

const propertyNames = new Map<string, string>()

/** Whether `value` is a nested style object, not an array, an `alpha()` result or a plain value. */
function isStyleObject(value: StyleValue): value is StyleObject {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !isAlphaColor(value)
  )
}

/** The CSS name of a style key: kebab-case, custom properties as written. */
function toPropertyName(key: string): string {
  if (key.startsWith('--')) return key
  let name = propertyNames.get(key)
  if (name === undefined) {
    name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^ms-/, '-ms-')
    propertyNames.set(key, name)
  }
  return name
}

const REFERENCE = 'var('
const HEX_PAIR = /^[0-9a-f]{2}$/i
/** The units that make a reference a time: `var(--x)ms` is `calc(var(--x) * 1ms)` when the value of `--x` is not known. */
const TIME_UNITS = new Set(['ms', 's'])
/**
 * The units that value repair reads after a reference (`var(--x)px`), longest first where one starts
 * another: each is a unit a `calc()` can multiply a number by. A unit must end there (`var(--x)pxa` is
 * left alone), and none is two hex digits, which are an opacity.
 */
const REPAIR_UNITS = [
  'ms',
  's',
  'px',
  'rem',
  'em',
  '%',
  'vmin',
  'vmax',
  'vh',
  'vw',
  'svh',
  'lvh',
  'dvh',
  'svw',
  'lvw',
  'dvw',
  'ch',
  'ex',
  'rlh',
  'lh',
  'cm',
  'mm',
  'in',
  'pt',
  'pc',
  'deg',
  'grad',
  'rad',
  'turn',
]
/** What may follow a number as its unit: letters or a percent sign, or nothing. */
const UNIT_TEXT = /^[a-z%]*$/i

/** Whether the character at `index` of `text` is a digit. */
function isDigitAt(text: string, index: number): boolean {
  // Past the end there is no code point, and no digit.
  const code = text.codePointAt(index) ?? 0
  return code >= 48 && code <= 57
}

/** The index after the digits of `text` that start at `index`. */
function skipDigits(text: string, index: number): number {
  let end = index
  while (isDigitAt(text, end)) end++
  return end
}

/** The index after an exponent (`e3`, `E-2`) that starts at `index`, or `index` when none does: an `e` with no digit after it starts a unit (`em`, `ex`). */
function skipExponent(text: string, index: number): number {
  if (text[index] !== 'e' && text[index] !== 'E') return index
  const digits = text[index + 1] === '+' || text[index + 1] === '-' ? index + 2 : index + 1
  return isDigitAt(text, digits) ? skipDigits(text, digits) : index
}

/**
 * The unit of `text` when it is a number with a unit after it, in lower case (`''` for a plain number);
 * undefined when it is not such a value. It is what the declared value of a token is when it is a
 * length, a time or a plain number.
 */
function readNumberUnit(text: string): string | undefined {
  const start = text.startsWith('+') || text.startsWith('-') ? 1 : 0
  const whole = skipDigits(text, start)
  const fraction = text[whole] === '.' ? skipDigits(text, whole + 1) : whole
  // A number has a digit, before the point or after it: `.` alone and no digits at all are not one.
  const hasDigits = whole > start || fraction > whole + 1
  if (!hasDigits) return undefined
  const unit = text.slice(skipExponent(text, fraction))
  return UNIT_TEXT.test(unit) ? unit.toLowerCase() : undefined
}

/** Whether the character code `code` can be part of an identifier: a letter, a digit, `-`, `_` or any non-ASCII character. NaN (past either end of the text) cannot. */
function isNameCode(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 45 ||
    code === 95 ||
    code >= 128
  )
}

/** Whether the character at `index` is a minus that stands alone before a reference: at the start of the value, or after a space, a comma or `(`. */
function isLoneMinus(value: string, index: number): boolean {
  return value[index] === '-' && (index === 0 || ' ,('.includes(value[index - 1]))
}

/** The index just after the parenthesis that closes the one before `start`, or -1 when none does. */
function findClose(value: string, start: number): number {
  let depth = 1
  for (let index = start; index < value.length; index++) {
    if (value[index] === '(') depth++
    else if (value[index] === ')' && --depth === 0) return index + 1
  }
  return -1
}

/** What value repair reads and tells besides the value: the declared value of a variable, and where a form that it leaves is reported. */
interface RepairContext {
  /** The declared value of the variable `name` (`--x`), or undefined when it is not known. */
  readValue?: (name: string) => string | undefined
  /** Told, in a sentence, about a reference followed by a unit that is left as it is. */
  report?: (message: string) => void
  /** The text a report starts with: the selector and the declaration. */
  owner: string
}

/** The unit at `index` of `value` (lowercase) that ends there, or undefined. */
function readUnit(value: string, index: number): string | undefined {
  for (const unit of REPAIR_UNITS) {
    const end = index + unit.length
    if (value.slice(index, end).toLowerCase() === unit && !isNameCode(codeAt(value, end))) {
      return unit
    }
  }
  return undefined
}

/** The declared value of the reference whose text inside `var(...)` is `inner`: the token's, else its fallback. */
function readDeclared(inner: string, context: RepairContext): string | undefined {
  const comma = inner.indexOf(',')
  const name = (comma === -1 ? inner : inner.slice(0, comma)).trim()
  return context.readValue?.(name) ?? (comma === -1 ? undefined : inner.slice(comma + 1).trim())
}

/**
 * The text of `reference` followed by `unit`: the reference alone when its value has that unit, a
 * `calc()` of the unit when it is a plain number (or, for a time, when it is not known), else undefined,
 * after `context.report` is told why.
 */
function repairUnit(
  reference: string,
  inner: string,
  unit: string,
  context: RepairContext
): string | undefined {
  const declared = readDeclared(inner, context)
  if (declared === undefined && TIME_UNITS.has(unit)) return `calc(${reference} * 1${unit})`
  const valueUnit = declared === undefined ? undefined : readNumberUnit(declared)
  if (valueUnit === unit) return reference
  if (valueUnit === '') return `calc(${reference} * 1${unit})`
  const start = `${context.owner}, which puts "${unit}" after ${reference}, whose value`
  const end = 'it is left as it is, and the browser drops it.'
  let problem = `${declared} has another unit: ${end} Write the value in ${unit}, or the reference alone.`
  if (declared === undefined) {
    problem = `is not known (no token of the theme has it): ${end} Write calc(${reference} * 1${unit}) for a number, or the reference alone for a length.`
  } else if (valueUnit === undefined) {
    problem = `${declared} is not a number: ${end} Write the reference alone.`
  }
  context.report?.(`${start} ${problem}`)
  return undefined
}

/**
 * `reference` with what follows it at `index` taken in, and where the rest of the value starts: two hex
 * digits of alpha are what `alpha()` writes for that opacity, a unit is taken in as `repairUnit` says.
 * The digits or the unit must end there: `var(--x)1Fa` is left alone.
 */
function repairSuffix(
  value: string,
  index: number,
  reference: string,
  inner: string,
  context: RepairContext
): [string, number] {
  const pair = value.slice(index, index + 2)
  if (HEX_PAIR.test(pair) && !isNameCode(codeAt(value, index + 2))) {
    return [String(alpha(reference, Number.parseInt(pair, 16) / 255)), index + 2]
  }
  const unit = readUnit(value, index)
  const repaired = unit === undefined ? undefined : repairUnit(reference, inner, unit, context)
  return repaired === undefined ? [reference, index] : [repaired, index + (unit as string).length]
}

/**
 * `value` with the string forms of token maths that are never valid CSS rewritten: a reference followed
 * by two hex digits (`var(--x)1F`) as `alpha()` writes it, a minus before a reference (`-var(--x)`) as
 * `negate()` writes it, and a reference followed by a unit (`var(--x)px`, `var(--x)ms`) as `repairUnit`
 * says. A reference may have a fallback, which is repaired too. Any other text is kept as it is.
 */
function repairValue(value: string, context: RepairContext): string {
  let repaired = ''
  let from = 0
  let index = value.indexOf(REFERENCE)
  while (index !== -1) {
    const hasMinus = isLoneMinus(value, index - 1)
    // `xvar(` is another function: what is inside it is read on.
    if (isNameCode(codeAt(value, index - 1)) && !hasMinus) {
      index = value.indexOf(REFERENCE, index + REFERENCE.length)
      continue
    }
    const close = findClose(value, index + REFERENCE.length)
    if (close === -1) break
    const inner = value.slice(index + REFERENCE.length, close - 1)
    const repairedInner = repairValue(inner, context)
    const reference = `${REFERENCE}${repairedInner})`
    const [text, end] = repairSuffix(value, close, reference, repairedInner, context)
    const start = hasMinus ? index - 1 : index
    repaired += value.slice(from, start) + (hasMinus ? String(negate(text)) : text)
    from = end
    index = value.indexOf(REFERENCE, end)
  }
  return repaired + value.slice(from)
}

/**
 * The CSS text of one declared value of the property `name`: a number is a time in `ms` (0 too: a time
 * needs its unit), or a length in `px` unless it is 0 or the property takes a plain number. With
 * `hasValueRepair` a string that holds a reference, outside a custom property, has its string forms of
 * token maths rewritten.
 */
function toValue(
  key: string,
  name: string,
  value: string | number,
  selector: string,
  context: CompileContext
): string {
  if (typeof value === 'string') {
    if (!context.hasValueRepair || !value.includes(REFERENCE) || key.startsWith('--')) return value
    const { readValue, report } = context
    return repairValue(value, { readValue, report, owner: `${selector} declares ${name}:${value}` })
  }
  if (TIMES.has(key)) return `${value}ms`
  const hasUnit = value !== 0 && !key.startsWith('--') && !UNITLESS.has(key)
  return hasUnit ? `${value}px` : String(value)
}

/** Splits `selector` on the commas that are not inside brackets or parentheses. */
function splitSelectors(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index]
    if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth--
    else if (char === ',' && depth === 0) {
      parts.push(selector.slice(start, index).trim())
      start = index + 1
    }
  }
  parts.push(selector.slice(start).trim())
  return parts
}

/** `selector` as the engine writes a selector list: each part trimmed, joined by `,` with no space (`html, body` is `html,body`). */
export function toSelectorText(selector: string): string {
  return splitSelectors(selector).join(',')
}

/** The selector of one part of a key inside one parent: `&` is the parent, a leading colon is the parent itself, anything else is a descendant. */
function joinSelector(one: string, part: string): string {
  if (part.includes('&')) return part.replaceAll('&', one)
  return part.startsWith(':') ? one + part : `${one} ${part}`
}

/** The selector a nested key makes inside `parent`, with `&` standing for the parent. */
function resolveSelector(parent: string, key: string): string {
  const parents = splitSelectors(parent)
  return splitSelectors(key)
    .flatMap((part) => parents.map((one) => joinSelector(one, part)))
    .join(',')
}

/**
 * `style` for the web: a style written for both platforms has a `web` part, which is merged over the
 * rest, and a `native` part, which is dropped.
 */
function resolveWebParts(style: StyleObject): StyleObject {
  if (!('web' in style) && !('native' in style)) return style
  const { web, native: _native, ...rest } = style
  return isStyleObject(web) ? mergeStyles([rest, web]) : rest
}

/**
 * The label `label` written after the label `earlier`, joined by `-`: `Typography` then `Link` is
 * `Typography-Link`. A label that `earlier` already has, as a whole run of its `-`-separated parts, is
 * not written again, and an empty one adds nothing.
 */
export function joinLabels(earlier: string, label: string): string {
  if (earlier === '') return label
  if (label === '' || `-${earlier}-`.includes(`-${label}-`)) return earlier
  return `${earlier}-${label}`
}

/** The value of `key` once `value` is merged over `earlier`: two labels are joined, two objects merged, else `value`. */
function mergeValue(key: string, earlier: StyleValue, value: StyleValue): StyleValue {
  if (key === 'label' && typeof earlier === 'string' && typeof value === 'string') {
    return joinLabels(earlier, value)
  }
  return isStyleObject(earlier) && isStyleObject(value) ? mergeStyles([earlier, value]) : value
}

/**
 * Merges style objects left to right; a later key wins and moves to the end; nested objects merge the
 * same way. A key whose value is `undefined`, `null` or `false` declares nothing, so it leaves an earlier
 * value of that key as it is: a parser that returns `{ width: undefined }` for a prop it was not given
 * does not erase the width of a style before it. Labels are not replaced: each is joined after the
 * labels before it (`joinLabels`), so the merged style names every style that has one, in order.
 */
export function mergeStyles(styles: readonly StyleObject[]): StyleObject {
  const merged: StyleObject = {}
  for (const style of styles) {
    for (const [key, value] of Object.entries(resolveWebParts(style))) {
      if (value === undefined || value === null || value === false) continue
      const earlier = merged[key]
      delete merged[key]
      merged[key] = mergeValue(key, earlier, value)
    }
  }
  return merged
}

/** What the compiler is given besides the style: how an `alpha()` value is written, whether string forms of token maths are repaired and with what, and how a condition is scoped. */
export interface CompileContext {
  /** Whether an `alpha()` value is written as its fallback, then its mix. */
  hasColorFallbacks: boolean
  /** Whether the string forms of token maths that are never valid CSS are rewritten. */
  hasValueRepair: boolean
  /** How a condition key is scoped. */
  scoping: Scoping
  /** The declared value of a variable, by name (`--x`): value repair reads the unit of a token from it. */
  readValue?: (name: string) => string | undefined
  /** Told about each reference followed by a unit that value repair leaves as it is. */
  report?: (message: string) => void
  /** Whether a declaration that a supported browser needs in a prefixed form gets that form first (`PREFIXED_FORMS`). Default false. */
  hasVendorPrefixes?: boolean
}

/** `selector`, a list or one, with `text` in front of each of its parts. */
function prefixSelector(selector: string, text: string): string {
  return splitSelectors(selector)
    .map((part) => text + part)
    .join(',')
}

/** `selector`, a list or one, with `text` at the end of each of its parts. */
function suffixSelector(selector: string, text: string): string {
  return splitSelectors(selector)
    .map((part) => part + text)
    .join(',')
}

/**
 * The rules of `value` for the elements below `start`, down to the elements that match `limits`: one
 * `@scope` rule, or, without `hasScope`, the plain descendant selector (which does not stop at a limit).
 */
function compileScoped(
  selector: string,
  value: StyleObject,
  context: CompileContext,
  start: string,
  limits: string
): string[] {
  if (!context.scoping.hasScope) {
    return compileStyle(prefixSelector(selector, `:where(${start}) `), value, context)
  }
  const rules = compileStyle(selector, value, context)
  return rules.length > 0 ? [createScopeRule(start, limits, rules)] : []
}

/** The rules of a condition key: the style applies where the nearest theme, or the nearest color scheme, is the one named. */
function compileCondition(
  selector: string,
  condition: Condition,
  value: StyleObject,
  context: CompileContext
): string[] {
  const { prefix } = context.scoping
  if (condition.kind === 'theme') {
    const limit = `.${getBoundaryClass(prefix)}`
    return compileScoped(selector, value, context, `.${condition.id}`, limit)
  }
  const limits = (['light', 'dark'] as const).map((name) => `.${getSchemeClass(prefix, name)}`)
  const start = `.${getSchemeClass(prefix, condition.scheme)}`
  const scoped = compileScoped(selector, value, context, start, limits.join(','))
  // With no scheme marker above, the system preference decides.
  const guard = createNoSchemeGuard(prefix)
  const guarded = compileStyle(suffixSelector(selector, guard), value, context)
  const query = `@media (prefers-color-scheme: ${condition.scheme}){${guarded.join('')}}`
  return guarded.length > 0 ? [...scoped, query] : scoped
}

/** The rules of the nested style `value` under `key`: a condition scopes them, an at-rule wraps them, any other key is a selector inside `selector`. */
function compileNested(
  selector: string,
  key: string,
  value: StyleObject,
  context: CompileContext
): string[] {
  const condition = readCondition(key)
  if (condition) return compileCondition(selector, condition, value, context)
  if (!key.startsWith('@')) {
    return compileStyle(resolveSelector(selector, key), value, context)
  }
  return compileStyle(selector, value, context).map((rule) => `${key}{${rule}}`)
}

/** One item of a property's value: a value, or an `alpha()` result, which is two declarations (the fallback, then the mix) or just the mix. */
type DeclaredItem = string | number | AlphaColor

/** The declarations of one item: a custom property takes any text, so a fallback would always win there, and is not written. */
function toItemDeclarations(
  key: string,
  name: string,
  item: DeclaredItem,
  selector: string,
  context: CompileContext
): string {
  if (!isAlphaColor(item)) return `${name}:${toValue(key, name, item, selector, context)};`
  const hasFallback = context.hasColorFallbacks && !key.startsWith('--')
  const fallback = hasFallback ? `${name}:${item.fallback};` : ''
  return `${fallback}${name}:${item.value};`
}

/** The declarations of `items` under the property `name`; a function is never CSS, and is left out (with the development checks, `findInvalidValues` reports it). */
function toListDeclarations(
  key: string,
  name: string,
  items: readonly unknown[],
  selector: string,
  context: CompileContext
): string {
  let text = ''
  for (const item of items) {
    if (typeof item !== 'function') {
      text += toItemDeclarations(key, name, item as DeclaredItem, selector, context)
    }
  }
  return text
}

/** Whether `style` declares one of `keys` (the spellings of one property): a value that declares nothing does not count. */
function hasDeclared(style: StyleObject, keys: readonly string[]): boolean {
  return keys.some((key) => {
    const value = style[key]
    return value !== undefined && value !== null && value !== false
  })
}

/** The declaration of `form` for `items`, unless the author wrote it in `style` already, or no item needs it. */
function toPrefixedDeclarations(
  key: string,
  form: PrefixedForm,
  items: readonly unknown[],
  style: StyleObject,
  selector: string,
  context: CompileContext
): string {
  const { property, value, forValue, keys } = form
  if (value === undefined) {
    if (hasDeclared(style, keys)) return ''
    return toListDeclarations(key, property, items, selector, context)
  }
  // A form of a value is the same property: the author's values are `items`.
  return items.includes(forValue) && !items.includes(value) ? `${property}:${value};` : ''
}

/**
 * The declarations of one property: one for a value, one for each item of a fallback list; with
 * `hasVendorPrefixes`, after the prefixed forms that a supported browser needs (`PREFIXED_FORMS`).
 */
function toDeclarations(
  key: string,
  value: DeclaredItem | readonly DeclaredItem[],
  style: StyleObject,
  selector: string,
  context: CompileContext
): string {
  const name = toPropertyName(key)
  const isList = Array.isArray(value)
  let standard = ''
  if (isList)
    standard = toListDeclarations(key, name, value as readonly unknown[], selector, context)
  else if (typeof value !== 'function') {
    standard = toItemDeclarations(key, name, value as DeclaredItem, selector, context)
  }
  const forms = context.hasVendorPrefixes ? PREFIXED_FORMS.get(name) : undefined
  if (forms === undefined) return standard
  const items: readonly unknown[] = isList ? (value as readonly unknown[]) : [value]
  let prefixedText = ''
  for (const form of forms) {
    prefixedText += toPrefixedDeclarations(key, form, items, style, selector, context)
  }
  return prefixedText + standard
}

/** The rules of `style` for `selector`, with the options of `context`. */
function compileStyle(selector: string, style: StyleObject, context: CompileContext): string[] {
  let declarations = ''
  const nested: string[] = []

  for (const [key, value] of Object.entries(style)) {
    if (key === 'label' || value === null || value === undefined || value === false) continue
    if (isStyleObject(value)) nested.push(...compileNested(selector, key, value, context))
    else declarations += toDeclarations(key, value, style, selector, context)
  }

  return declarations ? [`${selector}{${declarations}}`, ...nested] : nested
}

/**
 * The flat CSS rules of `style` for `selector`; without `hasColorFallbacks` an `alpha()` result is
 * written as its mix alone. A `when()` or `whenScheme()` key becomes a scoped rule, written as
 * `scoping` says. With `hasValueRepair` the string forms of token maths that are never valid CSS
 * (`var(--x)1F`, `-var(--x)`, `var(--x)ms`) are rewritten in each value.
 */
export function compileRules(
  selector: string,
  style: StyleObject,
  hasColorFallbacks = true,
  scoping: Scoping = DEFAULT_SCOPING,
  hasValueRepair = false
): string[] {
  return compileStyle(selector, style, { hasColorFallbacks, hasValueRepair, scoping })
}

/**
 * `compileRules` with every option in `context`: with `hasValueRepair`, the unit of a reference is read
 * from `readValue`, and what is left as it is reported to `report`; with `hasVendorPrefixes`, each
 * declaration of `PREFIXED_FORMS` is written after its prefixed forms. `compileRules` writes none.
 */
export function compileStyleRules(
  selector: string,
  style: StyleObject,
  context: CompileContext
): string[] {
  return compileStyle(selector, style, context)
}

/** The label of `style` (its `label` key), or ''. */
export function readLabel(style: StyleObject): string {
  const { label } = style
  return typeof label === 'string' ? label : ''
}
