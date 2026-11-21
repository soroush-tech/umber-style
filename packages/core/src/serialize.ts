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
/** The units that make a reference a time: `var(--x)ms` is `calc(var(--x) * 1ms)`. */
const TIME_UNITS = ['ms', 's']

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

/**
 * `reference` with what follows it at `at` taken in, and where the rest of the value starts: two hex
 * digits of alpha are what `alpha()` writes for that opacity, a time unit makes a `calc()` of a time.
 * The digits or the unit must end there: `var(--x)1Fa` is left alone.
 */
function repairSuffix(value: string, index: number, reference: string): [string, number] {
  const pair = value.slice(index, index + 2)
  if (HEX_PAIR.test(pair) && !isNameCode(codeAt(value, index + 2))) {
    return [String(alpha(reference, Number.parseInt(pair, 16) / 255)), index + 2]
  }
  for (const unit of TIME_UNITS) {
    const end = index + unit.length
    if (value.slice(index, end).toLowerCase() === unit && !isNameCode(codeAt(value, end))) {
      return [`calc(${reference} * 1${unit})`, end]
    }
  }
  return [reference, index]
}

/**
 * `value` with the string forms of token maths that are never valid CSS rewritten: a reference followed
 * by two hex digits (`var(--x)1F`) as `alpha()` writes it, a minus before a reference (`-var(--x)`) as
 * `negate()` writes it, and a reference followed by `ms` or `s` as a `calc()` of a time. A reference may
 * have a fallback, which is repaired too. Any other text is kept as it is.
 */
function repairValue(value: string): string {
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
    const [text, end] = repairSuffix(value, close, `${REFERENCE}${repairValue(inner)})`)
    const start = hasMinus ? index - 1 : index
    repaired += value.slice(from, start) + (hasMinus ? String(negate(text)) : text)
    from = end
    index = value.indexOf(REFERENCE, end)
  }
  return repaired + value.slice(from)
}

/**
 * The CSS text of one declared value: a number is a time in `ms` (0 too: a time needs its unit), or a
 * length in `px` unless it is 0 or the property takes a plain number. With `hasValueRepair` a string
 * that holds a reference, outside a custom property, has its string forms of token maths rewritten.
 */
function toValue(key: string, value: string | number, hasValueRepair: boolean): string {
  if (typeof value === 'string') {
    if (!hasValueRepair || !value.includes(REFERENCE) || key.startsWith('--')) return value
    return repairValue(value)
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

/** Merges style objects left to right; a later key wins and moves to the end; nested objects merge the same way. */
export function mergeStyles(styles: readonly StyleObject[]): StyleObject {
  const merged: StyleObject = {}
  for (const style of styles) {
    for (const [key, value] of Object.entries(resolveWebParts(style))) {
      const earlier = merged[key]
      delete merged[key]
      merged[key] =
        isStyleObject(earlier) && isStyleObject(value) ? mergeStyles([earlier, value]) : value
    }
  }
  return merged
}

/** What the compiler is given besides the style: how an `alpha()` value is written, whether string forms of token maths are repaired, and how a condition is scoped. */
interface CompileContext {
  hasColorFallbacks: boolean
  hasValueRepair: boolean
  scoping: Scoping
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
  context: CompileContext
): string {
  if (!isAlphaColor(item)) return `${name}:${toValue(key, item, context.hasValueRepair)};`
  const hasFallback = context.hasColorFallbacks && !key.startsWith('--')
  const fallback = hasFallback ? `${name}:${item.fallback};` : ''
  return `${fallback}${name}:${item.value};`
}

/** The declarations of one property: one for a value, one for each item of a fallback list. */
function toDeclarations(
  key: string,
  value: DeclaredItem | readonly DeclaredItem[],
  context: CompileContext
): string {
  const name = toPropertyName(key)
  const items = Array.isArray(value) ? (value as readonly DeclaredItem[]) : [value as DeclaredItem]
  return items.map((item) => toItemDeclarations(key, name, item, context)).join('')
}

/** The rules of `style` for `selector`, with the options of `context`. */
function compileStyle(selector: string, style: StyleObject, context: CompileContext): string[] {
  let declarations = ''
  const nested: string[] = []

  for (const [key, value] of Object.entries(style)) {
    if (key === 'label' || value === null || value === undefined || value === false) continue
    if (isStyleObject(value)) nested.push(...compileNested(selector, key, value, context))
    else declarations += toDeclarations(key, value, context)
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

/** The label of `style` (its `label` key), or ''. */
export function readLabel(style: StyleObject): string {
  const { label } = style
  return typeof label === 'string' ? label : ''
}
