export type StyleValue =
  | string
  | number
  | null
  | undefined
  | false
  | readonly (string | number)[]
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

/** Whether `value` is a nested style object, not an array or a plain value. */
function isStyleObject(value: StyleValue): value is StyleObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

/** The selector a nested key makes inside `parent`, with `&` standing for the parent. */
function resolveSelector(parent: string, key: string): string {
  const parents = splitSelectors(parent)
  return splitSelectors(key)
    .flatMap((part) =>
      parents.map((one) => (part.includes('&') ? part.replaceAll('&', one) : `${one} ${part}`))
    )
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

/** The rules of the nested style `value` under `key`: an at-rule wraps them, any other key is a selector inside `selector`. */
function compileNested(selector: string, key: string, value: StyleObject): string[] {
  if (!key.startsWith('@')) return compileRules(resolveSelector(selector, key), value)
  return compileRules(selector, value).map((rule) => `${key}{${rule}}`)
}

/** The declarations of one property: one for a value, one for each item of a fallback list. */
function toDeclarations(
  key: string,
  value: string | number | readonly (string | number)[]
): string {
  const name = toPropertyName(key)
  const items = typeof value === 'object' ? value : [value]
  return items.map((item) => `${name}:${toValue(key, item)};`).join('')
}

/** The flat CSS rules of `style` for `selector`. */
export function compileRules(selector: string, style: StyleObject): string[] {
  let declarations = ''
  const nested: string[] = []

  for (const [key, value] of Object.entries(style)) {
    if (key === 'label' || value === null || value === undefined || value === false) continue
    if (isStyleObject(value)) nested.push(...compileNested(selector, key, value))
    else declarations += toDeclarations(key, value)
  }

  return declarations ? [`${selector}{${declarations}}`, ...nested] : nested
}

/** The label of `style` (its `label` key), or ''. */
export function readLabel(style: StyleObject): string {
  const { label } = style
  return typeof label === 'string' ? label : ''
}
