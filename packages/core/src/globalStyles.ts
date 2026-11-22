import type * as CSS from 'csstype'
import { isAlphaColor } from './alpha'
import { hashString } from './hash'
import {
  compileStyleRules,
  readLabel,
  toSelectorText,
  type CompileContext,
  type StyleObject,
} from './serialize'
import { isSheetEntry, readEntryStyle, type SheetEntry } from './sheetEntry'
import { DEFAULT_SCOPING } from './scope'
import { createStandIn, readStandIn } from './standIn'
import type { TemplateValue } from './styleTypes'
import { isTemplateStrings, parseStyleTemplate } from './templateStyle'
import type { WebStyleObject } from './webStyle'

/** The descriptors of an at-rule that takes them (`@font-face`, `@page`, `@counter-style`, `@font-palette-values`), by camelCase name. */
export type AtRuleDescriptors =
  | CSS.AtRule.FontFace<string | number>
  | CSS.AtRule.Page<string | number>
  | CSS.AtRule.CounterStyle<string | number>
  | CSS.AtRule.FontPaletteValues<string | number>

/**
 * What a key of global styles holds: the style of a selector (an object, or a `css()` result or sheet
 * entry, whose style is used), the styles that an at-rule such as `@media` holds (selectors as keys), the
 * descriptors of an at-rule such as `@font-face`, or a list of those (an at-rule written once for each,
 * because an object cannot hold the same key twice).
 */
export type GlobalStyleValue =
  | WebStyleObject
  | SheetEntry
  | GlobalStyleObject
  | AtRuleDescriptors
  | readonly (WebStyleObject | SheetEntry | AtRuleDescriptors)[]
  | null
  | undefined
  | false

/**
 * Styles that are not a class: selectors (`body`, `html, body`, `*, *::before, *::after`, `#root`) and
 * at-rules (`@media (...)` holding selectors, `@supports`, `@font-face`) as keys. A selector's style is
 * written as a class's is: `&` in a nested key stands for the selector.
 */
export interface GlobalStyleObject {
  [key: string]: GlobalStyleValue
}

/** What `globalStyles` is given: the styles, or a function of the theme that returns them. */
export type GlobalStylesInput<T> = GlobalStyleObject | ((theme: T) => GlobalStyleObject)

/** Global styles that `globalStyles` made: frozen, and identified by their content. */
export interface GlobalStyles<T = never> {
  /** `global-<hash>`, made from the styles alone (a function of the theme is read with a stand-in theme): equal styles give an equal id. */
  readonly id: string
  /** The styles: those given, or what the function returns for the theme that `readTheme` gives, which is called only then. */
  resolve(readTheme: () => T): GlobalStyleObject
  /**
   * The CSS text of the styles as global rules (`html,body{margin:0;}`), in the engine's text format and
   * with the defaults of a cache, no layer: made on first read, and nothing is written. Undefined for a
   * function of the theme, whose rules need the theme of an engine.
   */
  readonly styles: string | undefined
}

/**
 * Global styles in any form an engine takes: a handle, an object, a `css()` value or sheet entry (its
 * nested rules are the global rules), a function of the theme that returns any of these, nothing
 * (`null`, `undefined`, `false`), or a list of them, nested to any depth, written in the order of the list.
 */
export type GlobalInput<T> =
  | GlobalStyles<T>
  | GlobalStyleObject
  | SheetEntry
  | ((theme: T) => GlobalInput<T>)
  | null
  | undefined
  | false
  | readonly GlobalInput<T>[]

const BRAND = Symbol.for('umber-style.global-styles')

/** The at-rules that hold rules (selectors as keys); every other at-rule holds declarations. */
const GROUP_AT_RULE = /^@(?:media|supports|container|layer|scope|starting-style|document)(?![\w-])/

/** How the `styles` text of a handle is written: the defaults of a cache. */
const TEXT_CONTEXT: CompileContext = {
  hasColorFallbacks: true,
  hasValueRepair: false,
  hasVendorPrefixes: true,
  scoping: DEFAULT_SCOPING,
}

/** `value` for the id of a handle: a stand-in as its path, everything else as it is. */
function toText(_key: string, value: unknown): unknown {
  return readStandIn(value)
}

/**
 * Makes global styles and returns their handle at once: nothing is written until an engine is given the
 * handle (`insertGlobal`), so a module can call it before there is an engine or a theme. The id is made
 * from the styles alone; a function of the theme is called for it with a stand-in theme whose every token
 * is its own path as text. As a tag, the template is read as CSS text (`parseStyleTemplate`): selectors
 * and at-rules with their blocks, and a function among the interpolations is called with `{ theme }`.
 * Throws a `TypeError` for styles that are not an object or a function.
 */
// A function first, the template, then the styles, last: see the forms of `styled` in a binding.
export function globalStyles<T = never>(styles: (theme: T) => GlobalStyleObject): GlobalStyles<T>
export function globalStyles<T = never>(
  template: TemplateStringsArray,
  ...values: TemplateValue<unknown, T>[]
): GlobalStyles<T>
export function globalStyles<T = never>(styles: GlobalStylesInput<T>): GlobalStyles<T>
export function globalStyles<T = never>(
  first: GlobalStylesInput<T> | TemplateStringsArray,
  ...values: unknown[]
): GlobalStyles<T> {
  if (isTemplateStrings(first)) {
    const parsed = parseStyleTemplate<{ theme: T }>(first, values)
    return globalStyles<T>(
      typeof parsed === 'function'
        ? (theme: T) => parsed({ theme }) as GlobalStyleObject
        : (parsed as GlobalStyleObject)
    )
  }
  const styles = first
  if (typeof styles === 'function') {
    const shown = JSON.stringify(styles(createStandIn('') as T), toText)
    const hash = hashString(`theme:${shown}`)
    return Object.freeze({
      [BRAND]: true,
      id: `global-${hash}`,
      resolve: (readTheme: () => T) => styles(readTheme()),
      styles: undefined,
    })
  }
  if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) {
    throw new TypeError(
      'globalStyles(): the styles must be an object, or a function that returns one.'
    )
  }
  let text: string | undefined
  return Object.freeze({
    [BRAND]: true,
    id: `global-${hashString(JSON.stringify(styles))}`,
    resolve: () => styles,
    get styles() {
      text ??= compileGlobalRules(styles, TEXT_CONTEXT).join('')
      return text
    },
  })
}

/** Whether `value` is a handle that `globalStyles` made. */
export function isGlobalStyles(value: unknown): value is GlobalStyles<unknown> {
  return typeof value === 'object' && value !== null && BRAND in value
}

/** Whether `value` of a key of a style is a nested rule (a selector or an at-rule that holds a style), not a declared value. */
function isNestedRule(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !isAlphaColor(value)
  )
}

/**
 * The global styles of a sheet entry (a `css()` value): each nested rule of its style, a selector or an
 * at-rule, is a global rule as it is written (`html`, `html, body`, `@media (...)`). A declaration of the
 * style itself has no selector to go under: it is left out, and `warn` is told about it.
 */
function readEntryGlobal(entry: SheetEntry, warn: ((message: string) => void) | undefined) {
  const style = readEntryStyle(entry, 'Global') as StyleObject
  const label = readLabel(style)
  const owner = label ? `the css() value "${label}"` : 'a css() value'
  const global: GlobalStyleObject = {}
  for (const [key, value] of Object.entries(style)) {
    if (isNestedRule(value)) global[key] = value as GlobalStyleObject
    else if (key !== 'label') {
      warn?.(
        `Global styles: ${owner} declares "${key}" outside a selector. A global rule needs a selector, so it is left out: put it under one (html, body, :root).`
      )
    }
  }
  return global
}

/** Adds to `found` the global styles of `input` (see `readGlobalInput`). */
function addGlobalInput<T>(
  input: GlobalInput<T>,
  readTheme: () => T,
  warn: ((message: string) => void) | undefined,
  found: GlobalStyleObject[]
): void {
  if (Array.isArray(input)) {
    for (const item of input as readonly GlobalInput<T>[])
      addGlobalInput(item, readTheme, warn, found)
  } else if (isGlobalStyles(input)) {
    addGlobalInput((input as GlobalStyles<T>).resolve(readTheme), readTheme, warn, found)
  } else if (typeof input === 'function') {
    addGlobalInput(input(readTheme()), readTheme, warn, found)
  } else if (isSheetEntry(input)) {
    found.push(readEntryGlobal(input, warn))
  } else if (input !== null && input !== undefined && input !== false) {
    // Anything else is given to the compiler, which throws a `TypeError` for what is not an object.
    found.push(input as GlobalStyleObject)
  }
}

/**
 * The sets of global styles of `input`, one for each item, in order: a list is read item by item at any
 * depth, a handle resolves itself, a function is called with the theme that `readTheme` gives (and what
 * it returns is read the same way), a `css()` value gives its nested rules (see `readEntryGlobal`, which
 * tells `warn` about a declaration it leaves out), and nothing is left out.
 */
export function readGlobalInput<T>(
  input: GlobalInput<T>,
  readTheme: () => T,
  warn?: (message: string) => void
): GlobalStyleObject[] {
  const found: GlobalStyleObject[] = []
  addGlobalInput(input, readTheme, warn, found)
  return found
}

/** The style of one item under `key` (a sheet entry is read as its style); a `TypeError` for anything that is not a style object. */
function readGlobalItem(key: string, each: unknown): GlobalStyleObject {
  const item = readEntryStyle(each, 'globalStyles')
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new TypeError(`globalStyles(): "${key}" must hold a style object, or a list of them.`)
  }
  return item as GlobalStyleObject
}

/** Adds to `rules` the rules of the style `item` under `key`: an at-rule that holds rules around the rules of its keys, any other key compiled as a class's style is. */
function addGlobalItemRules(
  rules: string[],
  key: string,
  item: GlobalStyleObject,
  context: CompileContext
): void {
  if (!GROUP_AT_RULE.test(key)) {
    rules.push(...compileStyleRules(toSelectorText(key), item as StyleObject, context))
    return
  }
  const inner = compileGlobalRules(item, context)
  if (inner.length > 0) rules.push(`${key}{${inner.join('')}}`)
}

/**
 * The flat CSS rules of global styles, in the order of their keys: a selector's style compiled as a
 * class's is, an at-rule that holds rules as one rule around the rules of its keys, any other at-rule as
 * a rule of declarations (one for each item of a list). Throws a `TypeError` for styles that are not an
 * object, and for a key that holds no style.
 */
export function compileGlobalRules(styles: GlobalStyleObject, context: CompileContext): string[] {
  if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) {
    throw new TypeError(
      'globalStyles(): the styles must be an object, or a function that returns one.'
    )
  }
  const rules: string[] = []
  for (const [key, value] of Object.entries(styles)) {
    if (value === null || value === undefined || value === false) continue
    for (const each of Array.isArray(value) ? value : [value]) {
      const item = readGlobalItem(key, each)
      addGlobalItemRules(rules, key, item, context)
    }
  }
  return rules
}
