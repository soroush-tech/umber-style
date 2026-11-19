import { hashString } from './hash'
import { isSheetEntry, type SheetEntry } from './sheetEntry'
import { compileRules, mergeStyles, readLabel, type StyleObject } from './serialize'
import type { WebStyleObject } from './webStyle'

export interface CacheOptions {
  /** First part of every class name. Default 'css'. Must match /^[a-z][a-z0-9-]*$/ or createCache throws. */
  prefix?: string
  /** Appended to every class name. Default ''. */
  suffix?: string
  /** Whether a style's label is part of its class name. Default true. */
  hasLabels?: boolean
  /** Where rules go. Default: a DOM sheet when `document` exists, otherwise an in-memory one. */
  sheet?: Sheet
}

export interface Sheet {
  insert(rule: string): void
  /** Every rule inserted so far, in order. */
  readonly rules: readonly string[]
}

export type ClassValue = WebStyleObject | SheetEntry | string | null | undefined | false

export interface Cache {
  readonly prefix: string
  /** The style object of each class this cache made, by class name. */
  readonly registered: ReadonlyMap<string, StyleObject>
  /**
   * One class for all of `values`: style objects, and class names this cache made (resolved back
   * to their styles), merged left to right so the last wins. Other class names pass through in
   * front of it. Returns '' when there is nothing.
   */
  css(...values: ClassValue[]): string
  /** Inserts `rules` once under `id`; returns whether it inserted them. */
  insertOnce(id: string, rules: readonly string[]): boolean
  /** The rules this cache inserted under `id` (a class name), or none: for a style element that a server component renders. */
  getRules(id: string): readonly string[]
  /** The CSS inserted so far and the ids it covers, for a server render or a static page. */
  extract(): { css: string; ids: string[] }
}

const PREFIX_PATTERN = /^[a-z][a-z0-9-]*$/

/** A sheet that keeps its rules in memory, for a server render or a test. */
export function createMemorySheet(): Sheet {
  const rules: string[] = []
  return {
    rules,
    insert(rule) {
      rules.push(rule)
    },
  }
}

/** A sheet in the style element marked `data-style="<key>"`, which it creates when there is none. */
export function createDomSheet(key: string, container: Node = document.head): Sheet {
  let element = document.querySelector<HTMLStyleElement>(`style[data-style="${key}"]`)
  if (!element) {
    element = document.createElement('style')
    element.dataset.style = key
    container.appendChild(element)
  }
  const sheet = element.sheet as CSSStyleSheet
  const rules: string[] = []
  return {
    rules,
    insert(rule) {
      try {
        sheet.insertRule(rule, sheet.cssRules.length)
        rules.push(rule)
      } catch {
        // A rule the browser rejects is skipped.
      }
    },
  }
}

/** The ids a server render marked as inserted, from its style element. */
function readInsertedIds(prefix: string): string[] {
  if (typeof document === 'undefined') return []
  const element = document.querySelector<HTMLElement>(`style[data-style="${prefix}"]`)
  return (element?.dataset.ids ?? '').split(/\s+/).filter(Boolean)
}

/** The class names in `value`, a class string or a sheet entry. */
function splitClassNames(value: string | SheetEntry): string[] {
  const names = typeof value === 'string' ? value : value.className
  return names.split(/\s+/).filter(Boolean)
}

/** Splits `values` into the styles to merge (registered classes resolved back) and the class names to pass through. */
function sortClassValues(
  values: readonly ClassValue[],
  registered: ReadonlyMap<string, StyleObject>
): { styles: StyleObject[]; rawClasses: string[] } {
  const styles: StyleObject[] = []
  const rawClasses: string[] = []
  for (const value of values) {
    if (!value) continue
    if (typeof value !== 'string' && !isSheetEntry(value)) {
      styles.push(value)
      continue
    }
    for (const name of splitClassNames(value)) {
      const style = registered.get(name)
      if (style) styles.push(style)
      else rawClasses.push(name)
    }
  }
  return { styles, rawClasses }
}

/** Makes a cache: it turns styles into classes and inserts each class's rules once. */
export function createCache(options: CacheOptions = {}): Cache {
  const { prefix = 'css', suffix = '', hasLabels = true } = options
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error(`Invalid cache prefix "${prefix}": use lowercase letters, digits and hyphens.`)
  }
  const insertedIds = new Set<string>(readInsertedIds(prefix))
  const sheet =
    options.sheet ??
    (typeof document === 'undefined' ? createMemorySheet() : createDomSheet(prefix))
  const registered = new Map<string, StyleObject>()

  const insertedRules = new Map<string, readonly string[]>()

  const insertOnce = (id: string, rules: readonly string[]): boolean => {
    if (insertedIds.has(id)) return false
    insertedIds.add(id)
    insertedRules.set(id, rules)
    for (const rule of rules) sheet.insert(rule)
    return true
  }

  const css = (...values: ClassValue[]): string => {
    const { styles, rawClasses } = sortClassValues(values, registered)
    if (styles.length === 0) return rawClasses.join(' ')

    const merged = mergeStyles(styles)
    const rules = compileRules('&', merged)
    if (rules.length === 0) return rawClasses.join(' ')
    const label = hasLabels ? readLabel(merged) : ''
    const hash = hashString(rules.join(''))
    const className = [prefix, label, hash].filter(Boolean).join('-') + suffix
    registered.set(className, merged)
    insertOnce(className, compileRules(`.${className}`, merged))
    return [...rawClasses, className].join(' ')
  }

  return {
    prefix,
    registered,
    css,
    insertOnce,
    getRules: (id) => insertedRules.get(id) ?? [],
    extract: () => ({ css: sheet.rules.join(''), ids: [...insertedIds] }),
  }
}
