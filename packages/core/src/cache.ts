import { hashString } from './hash'
import { createDevChecker, isDevelopment } from './devChecks'
import { createFingerprint, describeFingerprintDifferences } from './fingerprint'
import { scanStyleText, type StyleFindings } from './scanStyleText'
import {
  createSheetEntry,
  isSheetEntry,
  readEntrySource,
  type EntryRole,
  type EntrySource,
  type SheetEntry,
} from './sheetEntry'
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
  /**
   * Whether a property whose value is `alpha()` gets two declarations, the fallback first (rgba() for a
   * literal colour, else the colour itself) and then the color-mix() value, for a browser without
   * color-mix(). Default true. Without it only the color-mix() value is written.
   */
  hasColorFallbacks?: boolean
  /**
   * Whether a style written with `when()` or `whenScheme()` is scoped with `@scope`, so that it follows the
   * nearest theme. Default true. Without it the rule is the plain descendant form `:where(.theme) .class`,
   * which also matches below a nested theme, and so is wrong for nested themes. A browser without `@scope`
   * drops the scoped rules and keeps the rest.
   */
  hasScope?: boolean
  /**
   * Whether a styled component's style list is split by position into a base class (the plain objects
   * before the first function, made once) and a props class (the rest, made for each render), both in the
   * `components` layer. Default true. Without it the whole list is one class, as before. The cache only
   * holds the option; the engine's `createStyler` reads it.
   */
  hasBaseClass?: boolean
  /**
   * Whether the cache checks the page while it runs in a browser, and warns once for each problem found
   * (an engine class that has no rule, a variable that has no value): `findMissingStyles`, throttled,
   * after the first render and when rules are inserted. Default: on in development (`process.env.NODE_ENV`
   * is not `production`), off in production, and off where there is no `document`.
   */
  hasDevChecks?: boolean
  /** A short text that stands for the token options (modes, raw and length keys, registered tokens), for the stamp that the server writes and the browser compares. The engine gives it; '' when none. */
  tokenSignature?: string
  /** Where rules go. Default: a DOM sheet when `document` exists, otherwise an in-memory one. */
  sheet?: Sheet
}

/** What `extractPage` is told besides the classes of the page. */
export interface PageExtractOptions {
  /** Theme classes to include although no element has them (the themes the page offers for switching). */
  themes?: Iterable<string>
  /** Keys of the `<style href precedence>` elements that the document carries already: their rules are left out. */
  carried?: ReadonlySet<string>
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

/** How `cssWith` makes a class, beyond what is in it. */
export interface ClassOptions {
  /** The layer of the class. Default `components`. */
  layer?: ClassLayer
  /** A label for the class; it wins over the labels of the values. */
  label?: string
  /**
   * A class of this cache that is written before this one, and that this one is only used with (the base
   * class of a component, for its props class). It is part of the name, so that the same styles after two
   * different classes are two classes, each written after its own; and a sheet entry is merged in, never
   * used as it is, because its own class may have been written before `after`.
   */
  after?: string
}

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
  /**
   * `cssIn` with more to say about the class (see `ClassOptions`). When `values` is exactly one sheet
   * entry (and class names that are not the cache's) and there is no `after`, no class is made: the class
   * of the entry for that layer is used, and written if it was not.
   */
  cssWith(options: ClassOptions, ...values: ClassValue[]): string
  /** The entry of a style: its class names are worked out now and their rules are written when the entry is first used, in the layer of how it is used. */
  createEntry(style: WebStyleObject): SheetEntry
  /** The entry that `createEntry` made, by the class name it has when used on its own, for a framework that merged entries into one object. */
  findEntry(className: string): SheetEntry | undefined
  /** Whether a component's styles are split into a base class and a props class. */
  readonly hasBaseClass: boolean
  /**
   * Inserts `rules` once under `id`; returns whether it inserted them. With a `layer` (and layers on)
   * each rule is wrapped in it. Without one the rules are written as they are, outside every layer:
   * the place of an at-rule that is not a layer's to hold, such as `@property`.
   */
  insertOnce(id: string, rules: readonly string[], layer?: RuleLayer): boolean
  /** The rules this cache inserted under `id` (a class name), or none: for a style element that a server component renders. */
  getRules(id: string): readonly string[]
  /** Whether conditional rules are written with `@scope`. */
  readonly hasScope: boolean
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
  /**
   * Gives the cache the `@property` rule of each registered variable, by variable name (`createTokens`
   * makes them), replacing those it had. A rule is written once, outside every layer, when its variable
   * is first used (at once for a variable that is used already, or when there is no pruning); a rule
   * that is the same as a written one, or that a server render sent, is not written again.
   */
  registerProperties(rules: Readonly<Record<string, string>>): void
  /** `getRules` with every declaration of a theme class, used or not, after the `@property` rules of the registered variables it declares: for a style element that is sent before the rules that use the class. */
  getFullRules(id: string): readonly string[]
  /** The CSS inserted so far and the ids it covers (class names, then the used variables): all of the cache, whatever page asked for it. See `extractPage` for one page. */
  extract(): { css: string; ids: string[] }
  /**
   * The CSS that one page needs, decided from the class names it holds and not from what the cache holds:
   * the layer order statement; the `@property` rules of the variables in use; each theme class (of the
   * page, and `options.themes`) with only the variables the page's rules use (all that they refer to,
   * through the values of the themes too, and the variables marked with `markUsed`) and its color-scheme;
   * and the rules of the classes, in an order that depends on the classes only: a props class after its
   * base class, the rest by name. Names the cache made no rules for are ignored. It reads the cache and
   * changes nothing, so pages rendered at once, or in any order, get the same CSS.
   */
  extractPage(
    classNames: Iterable<string>,
    options?: PageExtractOptions
  ): { css: string; ids: string[] }
  /** The options that change the CSS or the class names, as a short text: the server stamps it on its style output and the browser compares it with its own. */
  readonly fingerprint: string
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

/** The selector of the style elements that hold engine rules: the cache's own, and the ones React hoists for the same prefix. */
function createStyleSelector(prefix: string): string {
  return `style[data-style="${prefix}"], style[data-precedence="${prefix}"]`
}

/** The stamp of the options that the server wrote: on a style element, or on the `<meta>` that a server component renders. */
function readServerStamp(prefix: string): string | undefined {
  const element = document.querySelector<HTMLElement>(
    `style[data-style="${prefix}"][data-options], meta[name="${prefix}-options"]`
  )
  return element?.dataset.options ?? element?.getAttribute('content') ?? undefined
}

/** The class names in `value`, a class string or a sheet entry. */
function splitClassNames(value: string | SheetEntry): string[] {
  const names = typeof value === 'string' ? value : value.className
  return names.split(/\s+/).filter(Boolean)
}

/**
 * Splits `values` into the styles to merge (the style of an entry a cache made, registered classes
 * resolved back) and the class names to pass through. `sole` is the entry when the one style is its own.
 */
function sortClassValues(
  values: readonly ClassValue[],
  registered: ReadonlyMap<string, StyleObject>
): { styles: StyleObject[]; rawClasses: string[]; sole: EntrySource | undefined } {
  const styles: StyleObject[] = []
  const rawClasses: string[] = []
  let entry: EntrySource | undefined
  for (const value of values) {
    if (!value) continue
    if (typeof value !== 'string' && !isSheetEntry(value)) {
      styles.push(value)
      continue
    }
    const source = typeof value === 'string' ? undefined : readEntrySource(value)
    if (source) {
      styles.push(source.style)
      entry = source
      continue
    }
    for (const name of splitClassNames(value)) {
      const style = registered.get(name)
      if (style) styles.push(style)
      else rawClasses.push(name)
    }
  }
  return { styles, rawClasses, sole: styles.length === 1 ? entry : undefined }
}

/** Makes a cache: it turns styles into classes and inserts each class's rules once. */
export function createCache(options: CacheOptions = {}): Cache {
  const {
    prefix = 'css',
    suffix = '',
    hasLabels = true,
    hasLayers = true,
    hasPruning = true,
    hasColorFallbacks = true,
    hasScope = true,
    hasBaseClass = true,
  } = options
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error(`Invalid cache prefix "${prefix}": use lowercase letters, digits and hyphens.`)
  }
  const fingerprint = createFingerprint({
    prefix,
    suffix,
    hasLabels,
    hasLayers,
    hasPruning,
    hasBaseClass,
    hasScope,
    hasColorFallbacks,
    tokens: options.tokenSignature ?? '',
  })
  const hasDocument = typeof document !== 'undefined'
  if (hasDocument) {
    const stamp = readServerStamp(prefix)
    const difference = stamp === undefined ? '' : describeFingerprintDifferences(stamp, fingerprint)
    if (difference !== '') throw new Error(difference)
  }
  const { hasDevChecks = hasDocument && isDevelopment() } = options
  const checkLater = hasDevChecks ? createDevChecker(prefix) : undefined
  // The ids of what is written, or was found on the page: class names, the layer order, `@property` rules.
  const insertedIds = new Set<string>()
  const used = new Set<string>()
  // The variables that were marked from outside the engine's own rules: always part of a page's themes.
  const pinned = new Set<string>()
  // The theme classes that the page has rules for, and the variables each of them declares there.
  const pageThemes = new Map<string, Set<string>>()
  // The class a props class was made after (its base class), by class name.
  const afters = new Map<string, string>()
  const sheet =
    options.sheet ??
    (typeof document === 'undefined' ? createMemorySheet() : createDomSheet(prefix))
  const registered = new Map<string, StyleObject>()
  const entries = new Map<string, SheetEntry>()
  const scoping = { prefix, hasScope }

  const insertedRules = new Map<string, readonly string[]>()
  // The `@property` rule of each registered variable, and the variables of each theme class.
  let propertyRules: Readonly<Record<string, string>> = {}
  const themeNames = new Map<string, readonly string[]>()

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
    if (layered.length > 0) checkLater?.()
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

  /** Writes the `@property` rule of the variable `name`, once; the rule of the same text is never written twice, a changed one is written after it and wins. */
  const writeProperty = (name: string): void => {
    const rule = propertyRules[name]
    if (rule === undefined) return
    if (insertOnce(`@property:${name}:${hashString(rule)}`, [rule])) insertedRules.set(name, [rule])
  }

  const registerProperties = (rules: Readonly<Record<string, string>>): void => {
    propertyRules = rules
    for (const name of Object.keys(rules)) {
      if (!hasPruning || used.has(name)) writeProperty(name)
    }
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
    fresh.forEach(writeProperty)
    for (const [className, entry] of themes) {
      writeTheme(
        className,
        entry,
        fresh.filter((name) => entry.declarations[name] !== undefined && !entry.written.has(name))
      )
    }
  }

  const insertTheme = (
    className: string,
    declarations: Readonly<Record<string, string>>,
    colorScheme?: string
  ): void => {
    const schemeText = colorScheme ? `color-scheme:${colorScheme};` : ''
    themeNames.set(className, Object.keys(declarations))
    const body = toDeclarationText(Object.entries(declarations)) + schemeText
    if (!hasPruning) {
      insertOnce(className, body ? [`.${className}{${body}}`] : [], 'theme')
      return
    }
    if (themes.has(className)) return
    // A theme class that the page has a rule for has its color-scheme, and the variables of that rule.
    const sent = pageThemes.get(className)
    const isSent = sent !== undefined
    insertedIds.add(className)
    const names = Object.keys(declarations)
    const written = new Set(isSent ? names.filter((name) => sent.has(name)) : [])
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
    const properties = (themeNames.get(id) ?? []).flatMap((name) => propertyRules[name] ?? [])
    if (entry === undefined) return [...properties, ...(insertedRules.get(id) ?? [])]
    const body = toDeclarationText(Object.entries(entry.declarations)) + entry.schemeText
    return [...properties, ...(body ? wrapInLayer([`.${id}{${body}}`], 'theme') : [])]
  }

  /** The name of a class: the layer and `after` are part of the hash, so that the same styles in two layers, or after two classes, are two classes. */
  const nameClass = (
    layer: ClassLayer,
    merged: StyleObject,
    rules: readonly string[],
    after: string
  ): string => {
    const label = hasLabels ? readLabel(merged) : ''
    const hash = hashString(
      (hasLayers && layer === 'overrides' ? layer : '') + after + rules.join('')
    )
    return [prefix, label, hash].filter(Boolean).join('-') + suffix
  }

  const cssWith = (options: ClassOptions, ...values: ClassValue[]): string => {
    const { layer = 'components', label, after = '' } = options
    const { styles, rawClasses, sole } = sortClassValues(values, registered)
    if (sole && after === '') return [...rawClasses, sole.use(layer)].filter(Boolean).join(' ')
    if (styles.length === 0) return rawClasses.join(' ')

    const merged = mergeStyles(label ? [...styles, { label }] : styles)
    const rules = compileRules('&', merged, hasColorFallbacks, scoping)
    if (rules.length === 0) return rawClasses.join(' ')
    const className = nameClass(layer, merged, rules, after)
    registered.set(className, merged)
    if (after !== '') afters.set(className, after)
    insertOnce(className, compileRules(`.${className}`, merged, hasColorFallbacks, scoping), layer)
    return [...rawClasses, className].join(' ')
  }

  const cssIn = (layer: ClassLayer, ...values: ClassValue[]): string =>
    cssWith({ layer }, ...values)

  const createEntry = (style: WebStyleObject): SheetEntry => {
    const merged = mergeStyles([style as StyleObject])
    const rules = compileRules('&', merged, hasColorFallbacks, scoping)
    const names: Partial<Record<EntryRole, string>> = {}
    const nameFor = (role: EntryRole): string => {
      names[role] ??= rules.length === 0 ? '' : nameClass(role, merged, rules, '')
      return names[role]
    }
    const source: EntrySource = {
      style: merged,
      use(role) {
        const name = nameFor(role)
        if (name !== '' && !registered.has(name)) {
          registered.set(name, merged)
          insertOnce(name, compileRules(`.${name}`, merged, hasColorFallbacks, scoping), role)
        }
        return name
      },
    }
    const entry = createSheetEntry(nameFor('components'), source)
    entries.set(nameFor('components'), entry)
    return entry
  }

  /** Takes in what rules on the page say: the classes, the layer order, the `@property` rules and the themes that are written, and the variables the rules use. */
  const absorb = (found: StyleFindings): void => {
    if (found.hasLayerOrder) insertedIds.add(layerOrderId)
    for (const name of found.classes) insertedIds.add(name)
    for (const [name, rule] of found.properties) {
      insertedIds.add(`@property:${name}:${hashString(rule)}`)
    }
    for (const [className, names] of found.themes) {
      insertedIds.add(className)
      const known = pageThemes.get(className) ?? new Set<string>()
      for (const name of names) known.add(name)
      pageThemes.set(className, known)
      const entry = themes.get(className)
      if (entry === undefined) continue
      entry.isSent = true
      for (const name of names) entry.written.add(name)
    }
    markUsed(found.variables)
  }

  if (hasDocument) {
    // The page is read once here, and again for every style element that arrives later.
    const selector = createStyleSelector(prefix)
    const scanned = new WeakSet<Element>()
    const scan = (element: Element): void => {
      if (scanned.has(element)) return
      scanned.add(element)
      absorb(scanStyleText(prefix, element.textContent as string))
    }
    for (const element of document.querySelectorAll(selector)) scan(element)
    // Rules reach the page without a call to the engine: streamed content, a route that a framework
    // fetches. A watch on the children of <head> notices the elements React hoists there.
    new MutationObserver((records) => {
      for (const { addedNodes } of records) {
        for (const node of addedNodes) {
          if (node instanceof Element && node.matches(selector)) scan(node)
        }
      }
      checkLater?.()
    }).observe(document.head, { childList: true })
    checkLater?.()
  }

  /** What orders the classes of a page: a props class is right after its base class (its `after`), the rest by name. */
  const sortKey = (id: string): string =>
    `${afters.get(id) ?? id}|${afters.has(id) ? '1' : '0'}${id}`

  /** The variables that the theme class `id` declares. */
  const readNames = (id: string): readonly string[] => themeNames.get(id) as readonly string[]

  /** The rules that the cache wrote under `id`, a class or a theme class it made. */
  const readRules = (id: string): readonly string[] => insertedRules.get(id) as readonly string[]

  /** The variables a page needs declared: those its rules refer to, those marked from outside, and what the values of the themes in play refer to. */
  const collectPageVariables = (classIds: readonly string[], themeIds: readonly string[]) => {
    const names = new Set(pinned)
    for (const id of classIds) {
      for (const rule of readRules(id)) {
        for (const name of scanVariables(rule, VARIABLE_START)) names.add(name)
      }
    }
    const queue = [...names]
    for (let index = 0; index < queue.length; index++) {
      for (const id of themeIds) {
        const value = themes.get(id)?.declarations[queue[index]]
        if (value === undefined) continue
        for (const name of scanVariables(value, VARIABLE_START)) {
          if (!names.has(name)) queue.push(name)
          names.add(name)
        }
      }
    }
    return names
  }

  /** The rule of a theme class for a page: with pruning, only the variables in `names`, and its color-scheme. */
  const createPageThemeRules = (id: string, names: ReadonlySet<string>): readonly string[] => {
    const entry = themes.get(id)
    if (entry === undefined) return readRules(id)
    const wanted = Object.keys(entry.declarations).filter((name) => names.has(name))
    const body =
      toDeclarationText(wanted.map((name) => [name, entry.declarations[name]])) + entry.schemeText
    return body === '' ? [] : wrapInLayer([`.${id}{${body}}`], 'theme')
  }

  const extractPage = (classNames: Iterable<string>, pageOptions: PageExtractOptions = {}) => {
    const { themes: offered = [], carried = new Set<string>() } = pageOptions
    const wanted = new Set([...classNames, ...offered])
    const themeIds = [...wanted].filter((name) => themeNames.has(name)).sort()
    const classIds = [...wanted]
      .filter((name) => name.startsWith(`${prefix}-`) && !themeNames.has(name))
      .filter((name) => insertedRules.has(name))
      .sort((first, second) => (sortKey(first) < sortKey(second) ? -1 : 1))
    const names = hasPruning ? collectPageVariables(classIds, themeIds) : new Set<string>()
    // A carried theme element holds the `@property` rules of the variables its theme declares.
    const covered = new Set(themeIds.filter((id) => carried.has(id)).flatMap(readNames))
    const declared = hasPruning ? names : themeIds.flatMap(readNames)
    const properties = [...new Set(declared)]
      .filter((name) => propertyRules[name] !== undefined && !covered.has(name))
      .sort()
    const newThemes = themeIds.filter((id) => !carried.has(id))
    const newClasses = classIds.filter((id) => !carried.has(id))
    const themeRules = newThemes.flatMap((id) => createPageThemeRules(id, names))
    const classRules = newClasses.flatMap(readRules)
    const hasLayered = themeRules.length + classRules.length > 0
    const css = [
      hasLayers && hasLayered ? layerOrder : '',
      ...properties.map((name) => propertyRules[name]),
      ...themeRules,
      ...classRules,
    ].join('')
    return { css, ids: [...newThemes, ...newClasses] }
  }

  return {
    prefix,
    hasLayers,
    layerOrder,
    registered,
    css: (...values) => cssIn('components', ...values),
    cssIn,
    cssWith,
    createEntry,
    findEntry: (className) => entries.get(className),
    hasBaseClass,
    hasScope,
    hasPruning,
    usedVariables: used,
    markUsed: (names) => {
      const list = [...names]
      for (const name of list) pinned.add(name)
      markUsed(list)
    },
    insertTheme,
    registerProperties,
    insertOnce,
    getRules: (id) => insertedRules.get(id) ?? [],
    getFullRules,
    extract: () => ({ css: sheet.rules.join(''), ids: [...insertedIds, ...used] }),
    extractPage,
    fingerprint,
  }
}
