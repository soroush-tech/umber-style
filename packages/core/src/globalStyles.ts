import type * as CSS from 'csstype'
import { hashString } from './hash'
import type { Scoping } from './scope'
import { compileRules, toSelectorText, type StyleObject } from './serialize'
import { readEntryStyle, type SheetEntry } from './sheetEntry'
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
}

/** Global styles in any form an engine takes: a handle, an object, a function of the theme, or a list of them, written in the order of the list. */
export type GlobalInput<T> =
  | GlobalStyles<T>
  | GlobalStylesInput<T>
  | readonly (GlobalStyles<T> | GlobalStylesInput<T>)[]

const BRAND = Symbol.for('umber-style.global-styles')

/** The at-rules that hold rules (selectors as keys); every other at-rule holds declarations. */
const GROUP_AT_RULE = /^@(?:media|supports|container|layer|scope|starting-style|document)(?![\w-])/

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
    })
  }
  if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) {
    throw new TypeError(
      'globalStyles(): the styles must be an object, or a function that returns one.'
    )
  }
  return Object.freeze({
    [BRAND]: true,
    id: `global-${hashString(JSON.stringify(styles))}`,
    resolve: () => styles,
  })
}

/** Whether `value` is a handle that `globalStyles` made. */
export function isGlobalStyles(value: unknown): value is GlobalStyles<unknown> {
  return typeof value === 'object' && value !== null && BRAND in value
}

/** The styles of one item of a `GlobalInput`: a handle resolves itself, a function is called with the theme that `readTheme` gives. */
export function readGlobalStyles<T>(
  item: GlobalStyles<T> | GlobalStylesInput<T>,
  readTheme: () => T
): GlobalStyleObject {
  if (isGlobalStyles(item)) return (item as GlobalStyles<T>).resolve(readTheme)
  return typeof item === 'function' ? item(readTheme()) : item
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
  hasColorFallbacks: boolean,
  scoping: Scoping,
  hasValueRepair: boolean
): void {
  if (!GROUP_AT_RULE.test(key)) {
    rules.push(
      ...compileRules(
        toSelectorText(key),
        item as StyleObject,
        hasColorFallbacks,
        scoping,
        hasValueRepair
      )
    )
    return
  }
  const inner = compileGlobalRules(item, hasColorFallbacks, scoping, hasValueRepair)
  if (inner.length > 0) rules.push(`${key}{${inner.join('')}}`)
}

/**
 * The flat CSS rules of global styles, in the order of their keys: a selector's style compiled as a
 * class's is, an at-rule that holds rules as one rule around the rules of its keys, any other at-rule as
 * a rule of declarations (one for each item of a list). Throws a `TypeError` for styles that are not an
 * object, and for a key that holds no style.
 */
export function compileGlobalRules(
  styles: GlobalStyleObject,
  hasColorFallbacks: boolean,
  scoping: Scoping,
  hasValueRepair: boolean
): string[] {
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
      addGlobalItemRules(rules, key, item, hasColorFallbacks, scoping, hasValueRepair)
    }
  }
  return rules
}
