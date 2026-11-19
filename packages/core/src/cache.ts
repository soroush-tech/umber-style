import { hashString } from './hash'
import { isSheetEntry, type SheetEntry } from './sheetEntry'
import { compileRules, mergeStyles, readLabel, type StyleObject } from './serialize'
import { toDeclarationText } from './theme'
import { scanVariables } from './variables'
import type { WebStyleObject } from './webStyle'

export interface CacheOptions {
  /** First part of every class name. Default 'css'. Must match /^[a-z][a-z0-9-]*$/ or createCache throws. */
  prefix?: string
  /** Appended to every class name. Default ''. */
  suffix?: string
  /** Whether a style's label is part of its class name. Default true. */
  hasLabels?: boolean
  /** Whether every rule goes into a cascade layer (`<prefix>-theme`, `-global`, `-components`, `-overrides`). Default true. */
  hasLayers?: boolean
  /**
   * Whether a theme class declares only the variables that rules refer to (and those marked with
   * `markUsed`), appending more as rules come in. Default true. Without it, a theme class declares every token.
   */
  hasPruning?: boolean
  /** Where rules go. Default: a DOM sheet when `document` exists, otherwise an in-memory one. */
  sheet?: Sheet
}

export interface Sheet {
  insert(rule: string): void
  /** Every rule inserted so far, in order. */
  readonly rules: readonly string[]
  /** Replaces the rule inserted at `index` of `rules`; a sheet that cannot (a browser one) has none, and the cache appends instead. */
  replace?(index: number, rule: string): void
}

/** The cascade layers of a cache, from the lowest priority to the highest. */
export const RULE_LAYERS = ['theme', 'global', 'components', 'overrides'] as const

export type RuleLayer = (typeof RULE_LAYERS)[number]

/** The layers that a class can be made in: the styles of a component, and what is given to it from outside. */
export type ClassLayer = 'components' | 'overrides'

export type ClassValue = WebStyleObject | SheetEntry | string | null | undefined | false

export interface Cache {
  readonly prefix: string
  /** Whether rules go into cascade layers. */
  readonly hasLayers: boolean
  /** The statement that declares the layers in order, `@layer <prefix>-theme,...;`, or '' without layers. It is the first rule of the sheet. */
  readonly layerOrder: string
  /** The style object of each class this cache made, by class name. */
  readonly registered: ReadonlyMap<string, StyleObject>
  /**
   * One class for all of `values`: style objects, and class names this cache made (resolved back
   * to their styles), merged left to right so the last wins. Other class names pass through in
   * front of it. Returns '' when there is nothing. The class is in the `components` layer.
   */
  css(...values: ClassValue[]): string
  /** `css`, with the layer of the class given: `overrides` for what a component is given from outside. */
  cssIn(layer: ClassLayer, ...values: ClassValue[]): string
  /** Inserts `rules` once under `id`, each wrapped in `layer` when there is one; returns whether it inserted them. */
  insertOnce(id: string, rules: readonly string[], layer?: RuleLayer): boolean
  /** The rules this cache inserted under `id` (a class name), or none: for a style element that a server component renders. */
  getRules(id: string): readonly string[]
  /** Whether theme classes declare only the variables in use. */
  readonly hasPruning: boolean
  /** The names of the variables that rules refer to, or that were marked: the only ones a pruned theme class declares. It only grows. */
  readonly usedVariables: ReadonlySet<string>
  /** Marks variables as used, plus those that the values of themes refer to, and declares them in every theme class that has them. Does nothing without pruning. */
  markUsed(names: Iterable<string>): void
  /**
   * Registers a theme class: `declarations` are all its variables, `colorScheme` is set by its rule.
   * Only the used variables are written, more when they become used; the class itself always exists.
   * Does nothing for a class that is already there.
   */
  insertTheme(
    className: string,
    declarations: Readonly<Record<string, string>>,
    colorScheme?: string
  ): void
  /** `getRules` with every declaration of a theme class, used or not: for a style element that is sent before the rules that use the class. */
  getFullRules(id: string): readonly string[]
  /** The CSS inserted so far and the ids it covers (class names, then the used variables), for a server render or a static page. */
  extract(): { css: string; ids: string[] }
}

/** The start of every variable name, and of the ids that mark a used variable. */
const VARIABLE_START = '--'

/** A theme class that a pruning cache has registered. */
interface ThemeEntry {
  /** Every variable of the theme class. */
  declarations: Readonly<Record<string, string>>
  /** The color-scheme declaration, or ''. */
  schemeText: string
  /** Whether a server render already sent the rule of this class (its color-scheme and the variables used then). */
  isSent: boolean
  /** Whether a first rule was written. */
  isStarted: boolean
  /** The variables written so far. */
  written: Set<string>
  /** The text of those variables. */
  variables: string
  /** Where the rule of the class is in the sheet, when the sheet can replace it. */
  index: number | undefined
  /** The rules written for the class. */
  rules: readonly string[]
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
    replace(index, rule) {
      rules[index] = rule
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
  const {
    prefix = 'css',
    suffix = '',
    hasLabels = true,
    hasLayers = true,
    hasPruning = true,
  } = options
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error(`Invalid cache prefix "${prefix}": use lowercase letters, digits and hyphens.`)
  }
  const hydratedIds = readInsertedIds(prefix)
  const insertedIds = new Set<string>(hydratedIds.filter((id) => !id.startsWith(VARIABLE_START)))
  // A server render marks the variables it declared, and declared no more than those.
  const hydratedUsed = new Set<string>(hydratedIds.filter((id) => id.startsWith(VARIABLE_START)))
  const used = new Set<string>(hydratedUsed)
  const sheet =
    options.sheet ??
    (typeof document === 'undefined' ? createMemorySheet() : createDomSheet(prefix))
  const registered = new Map<string, StyleObject>()

  const insertedRules = new Map<string, readonly string[]>()

  const layerOrder = hasLayers
    ? `@layer ${RULE_LAYERS.map((layer) => `${prefix}-${layer}`).join(',')};`
    : ''
  const layerOrderId = `${prefix}-layers`

  const wrapInLayer = (rules: readonly string[], layer?: RuleLayer): readonly string[] =>
    hasLayers && layer ? rules.map((rule) => `@layer ${prefix}-${layer}{${rule}}`) : rules

  // The order statement goes in before the first rule, once; a server render already marked it.
  const insertLayered = (layered: readonly string[]): void => {
    if (hasLayers && layered.length > 0 && !insertedIds.has(layerOrderId)) {
      insertedIds.add(layerOrderId)
      sheet.insert(layerOrder)
    }
    for (const rule of layered) sheet.insert(rule)
  }

  // Pruning: each registered theme class, with what it declares and what of that is written.
  const themes = new Map<string, ThemeEntry>()

  /** Writes `names` for a theme class: a rule of its own, or in place of the rule it has when the sheet can replace. */
  const writeTheme = (className: string, entry: ThemeEntry, names: readonly string[]): void => {
    const added = toDeclarationText(names.map((name) => [name, entry.declarations[name]]))
    const ownScheme = entry.isSent ? '' : entry.schemeText
    const first = entry.isStarted ? '' : ownScheme
    if (added + first === '') return
    entry.isStarted = true
    for (const name of names) entry.written.add(name)
    entry.variables += added
    const { index } = entry
    const body = index === undefined ? added + first : entry.variables + ownScheme
    const rules = wrapInLayer([`.${className}{${body}}`], 'theme')
    if (sheet.replace && index !== undefined) {
      sheet.replace(index, rules[0])
      entry.rules = rules
    } else {
      const before = sheet.rules.length
      insertLayered(rules)
      if (sheet.replace && sheet.rules.length > before) entry.index = sheet.rules.length - 1
      entry.rules = [...entry.rules, ...rules]
    }
    insertedRules.set(className, entry.rules)
  }

  const markUsed = (names: Iterable<string>): void => {
    if (!hasPruning) return
    const queue = [...names]
    const fresh: string[] = []
    for (let index = 0; index < queue.length; index++) {
      const name = queue[index]
      if (used.has(name)) continue
      used.add(name)
      fresh.push(name)
      // The value of a token in some theme may refer to another variable, which is then used too.
      for (const { declarations } of themes.values()) {
        const value = declarations[name]
        if (value !== undefined) queue.push(...scanVariables(value, VARIABLE_START))
      }
    }
    if (fresh.length === 0) return
    for (const [className, entry] of themes) {
      writeTheme(
        className,
        entry,
        fresh.filter((name) => entry.declarations[name] !== undefined)
      )
    }
  }

  const insertTheme = (
    className: string,
    declarations: Readonly<Record<string, string>>,
    colorScheme?: string
  ): void => {
    const schemeText = colorScheme ? `color-scheme:${colorScheme};` : ''
    const body = toDeclarationText(Object.entries(declarations)) + schemeText
    if (!hasPruning) {
      insertOnce(className, body ? [`.${className}{${body}}`] : [], 'theme')
      return
    }
    if (themes.has(className)) return
    // A theme class that the server sent has its color-scheme, and the variables that were used then.
    const isSent = insertedIds.has(className)
    insertedIds.add(className)
    const names = Object.keys(declarations)
    const written = new Set(isSent ? names.filter((name) => hydratedUsed.has(name)) : [])
    const entry: ThemeEntry = {
      declarations,
      schemeText,
      isSent,
      isStarted: false,
      written,
      variables: '',
      index: undefined,
      rules: [],
    }
    themes.set(className, entry)
    insertedRules.set(className, [])
    // A value of this theme may refer to a variable that no rule uses yet.
    markUsed(
      names
        .filter((name) => used.has(name))
        .flatMap((name) => scanVariables(declarations[name], VARIABLE_START))
    )
    writeTheme(
      className,
      entry,
      names.filter((name) => used.has(name) && !entry.written.has(name))
    )
  }

  function insertOnce(id: string, rules: readonly string[], layer?: RuleLayer): boolean {
    if (insertedIds.has(id)) return false
    insertedIds.add(id)
    const layered = wrapInLayer(rules, layer)
    insertedRules.set(id, layered)
    insertLayered(layered)
    if (hasPruning) markUsed(rules.flatMap((rule) => scanVariables(rule, VARIABLE_START)))
    return true
  }

  const getFullRules = (id: string): readonly string[] => {
    const entry = themes.get(id)
    if (entry === undefined) return insertedRules.get(id) ?? []
    const body = toDeclarationText(Object.entries(entry.declarations)) + entry.schemeText
    return body ? wrapInLayer([`.${id}{${body}}`], 'theme') : []
  }

  const cssIn = (layer: ClassLayer, ...values: ClassValue[]): string => {
    const { styles, rawClasses } = sortClassValues(values, registered)
    if (styles.length === 0) return rawClasses.join(' ')

    const merged = mergeStyles(styles)
    const rules = compileRules('&', merged)
    if (rules.length === 0) return rawClasses.join(' ')
    const label = hasLabels ? readLabel(merged) : ''
    // The layer is part of the hash, so that the same styles in two layers are two classes.
    const hash = hashString((hasLayers && layer === 'overrides' ? layer : '') + rules.join(''))
    const className = [prefix, label, hash].filter(Boolean).join('-') + suffix
    registered.set(className, merged)
    insertOnce(className, compileRules(`.${className}`, merged), layer)
    return [...rawClasses, className].join(' ')
  }

  return {
    prefix,
    hasLayers,
    layerOrder,
    registered,
    css: (...values) => cssIn('components', ...values),
    cssIn,
    hasPruning,
    usedVariables: used,
    markUsed,
    insertTheme,
    insertOnce,
    getRules: (id) => insertedRules.get(id) ?? [],
    getFullRules,
    extract: () => ({ css: sheet.rules.join(''), ids: [...insertedIds, ...used] }),
  }
}
