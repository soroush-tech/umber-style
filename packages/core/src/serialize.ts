import { isAlphaColor, type AlphaColor } from './alpha'
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

export type StyleValue =
  | string
  | number
  | AlphaColor
  | null
  | undefined
  | false
  | readonly (string | number | AlphaColor)[]
  | StyleObject

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

/** The CSS text of one declared value. */
function toValue(key: string, value: string | number): string {
  const isLength = typeof value === 'number' && value !== 0
  const hasUnit = isLength && !key.startsWith('--') && !UNITLESS.has(key)
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

/** What the compiler is given besides the style: how an `alpha()` value is written, and how a condition is scoped. */
interface CompileContext {
  hasColorFallbacks: boolean
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
  hasColorFallbacks: boolean
): string {
  if (!isAlphaColor(item)) return `${name}:${toValue(key, item)};`
  const hasFallback = hasColorFallbacks && !key.startsWith('--')
  return `${hasFallback ? `${name}:${item.fallback};` : ''}${name}:${item.value};`
}

/** The declarations of one property: one for a value, one for each item of a fallback list. */
function toDeclarations(
  key: string,
  value: DeclaredItem | readonly DeclaredItem[],
  hasColorFallbacks: boolean
): string {
  const name = toPropertyName(key)
  const items = Array.isArray(value) ? (value as readonly DeclaredItem[]) : [value as DeclaredItem]
  return items.map((item) => toItemDeclarations(key, name, item, hasColorFallbacks)).join('')
}

/** The rules of `style` for `selector`, with the options of `context`. */
function compileStyle(selector: string, style: StyleObject, context: CompileContext): string[] {
  let declarations = ''
  const nested: string[] = []

  for (const [key, value] of Object.entries(style)) {
    if (key === 'label' || value === null || value === undefined || value === false) continue
    if (isStyleObject(value)) nested.push(...compileNested(selector, key, value, context))
    else declarations += toDeclarations(key, value, context.hasColorFallbacks)
  }

  return declarations ? [`${selector}{${declarations}}`, ...nested] : nested
}

/**
 * The flat CSS rules of `style` for `selector`; without `hasColorFallbacks` an `alpha()` result is
 * written as its mix alone. A `when()` or `whenScheme()` key becomes a scoped rule, written as
 * `scoping` says.
 */
export function compileRules(
  selector: string,
  style: StyleObject,
  hasColorFallbacks = true,
  scoping: Scoping = DEFAULT_SCOPING
): string[] {
  return compileStyle(selector, style, { hasColorFallbacks, scoping })
}

/** The label of `style` (its `label` key), or ''. */
export function readLabel(style: StyleObject): string {
  const { label } = style
  return typeof label === 'string' ? label : ''
}
