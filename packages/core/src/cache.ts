import { hashString } from './hash'
import { createDevChecker, isDevelopment } from './devChecks'
import { createFingerprint, describeFingerprintDifferences } from './fingerprint'
import { compileGlobalRules, type GlobalStyleObject } from './globalStyles'
import { createKeyframesRule, findAnimationNames, isKeyframesName } from './keyframes'
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
   * Whether the string forms of token maths that are never valid CSS are rewritten in each value: a
   * reference followed by two hex digits (`var(--x)1F`) as `alpha()` writes it, a minus before a
   * reference (`-var(--x)`) as `negate()` writes it, and a reference followed by `ms` or `s` as a
   * `calc()` of a time. Custom properties are left alone. Default false.
   */
  hasValueRepair?: boolean
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
   * (`findMissingStyles`: an engine class that has no rule, a variable that has no value; `CSS.supports`: an inserted declaration that the browser does not support), throttled,
   * after the first render and when rules are inserted. Default: on in development (`process.env.NODE_ENV`
   * is not `production`), off in production, and off where there is no `document`.
   */
  hasDevChecks?: boolean
  /** A short text that stands for the token options (modes, raw and length keys, registered tokens), for the stamp that the server writes and the browser compares. The engine gives it; '' when none. */
  tokenSignature?: string
  /** Where rules go. Default: a DOM sheet when `document` exists, otherwise an in-memory one. */
  sheet?: Sheet
  /**
   * Called after each group of rules the cache writes to its sheet, with a name for the group and its
   * CSS text as written: the layer order statement (`<prefix>-layers`), a class, a theme class (each time
   * variables are added to it, the first time under the class name, later under `<class>-<hash>`), a set
   * of global rules (its id), a `@keyframes` rule (`@keyframes:<name>`) and a `@property` rule
   * (`@property:<variable>:<hash>`). Rules that the page has, and so are not written, are not reported.
   */
  onInsert?: (name: string, css: string) => void
}

/** A part of the CSS of a page, and the ids it covers. */
export interface PagePart {
  css: string
  ids: string[]
}

/** The CSS of a page in two parts, which make `extractPage` when joined in this order. */
export interface PageParts {
  /** What no class of the page stands for: the layer order, the `@property` and `@keyframes` rules, the theme classes and the global rules; its ids are the theme classes and the global ids. */
  global: PagePart
  /** The rules of the classes of the page; its ids are the classes. */
  classes: PagePart
}

/** What `extractPage` is told besides the classes of the page. */
export interface PageExtractOptions {
  /** Theme classes to include although no element has them (the themes the page offers for switching). */
  themes?: Iterable<string>
  /** Animation names (`keyframes` results) to include although no class of the page uses them. */
  animations?: Iterable<string>
  /** Keys of the `<style href precedence>` elements that the document carries already (classes, theme classes, animation names, ids of global rules): their rules are left out. */
  carried?: ReadonlySet<string>
}

export interface Sheet {
  insert(rule: string): void
  /** Every rule inserted so far and not removed, in order. */
  readonly rules: readonly string[]
  /** Replaces the rule inserted at `index` of `rules`; a sheet that cannot (a browser one) has none, and the cache appends instead. */
  replace?(index: number, rule: string): void
  /**
   * Removes the rule at `index` of `rules`: the rules after it move down by one, in `rules` and in what
   * the sheet holds. A sheet without it keeps every rule: global rules that are released then stay, and
   * count as written.
   */
  remove?(index: number): void
}

/** The rules of one set of global styles, resolved for a theme. */
export interface GlobalRules {
  /** `<prefix>-global-<hash>`, a hash of `rules`: equal rules have an equal id. A style element that holds them is keyed by it. */
  readonly id: string
  /** The rules, each in the `global` layer when the cache has layers. */
  readonly rules: readonly string[]
  /** The animation names (`keyframes` results) that the rules use, whose `@keyframes` rules are written with them. */
  readonly animations: readonly string[]
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
   * Makes the root theme `id` (`<prefix>-root-<hash>`, with `declarations` and `colorScheme`) the one
   * declared on the document root: one rule `:where(:root){...}` in the theme layer. Its specificity is
   * 0, so a theme class on `<html>` wins over it. With pruning only the used variables are written, more
   * as they become used. Another id replaces the rule (removed where the sheet can remove it, else
   * written again after it), and in a browser the root rules that a server render left in the page are
   * removed the first time; the same id again does nothing. Every id given is kept for `getFullRules`.
   */
  insertRoot(id: string, declarations: Readonly<Record<string, string>>, colorScheme?: string): void
  /**
   * Gives the cache the `@property` rule of each registered variable, by variable name (`createTokens`
   * makes them), replacing those it had. A rule is written once, outside every layer, when its variable
   * is first used (at once for a variable that is used already, or when there is no pruning); a rule
   * that is the same as a written one, or that a server render sent, is not written again.
   */
  registerProperties(rules: Readonly<Record<string, string>>): void
  /** Gives the cache the theme that steps written as a function of the theme are resolved against, read when a `@keyframes` rule is first written (the engine gives its references). */
  setKeyframesTheme(read: () => unknown): void
  /**
   * Writes the `@keyframes` rule of `name` (a `keyframes` result) now, once, outside every layer: for a
   * use that the cache cannot see in a class. A rule that is written, or that the page has, is not written
   * again. Throws a `TypeError` for a name that `keyframes` did not return.
   */
  insertKeyframes(name: string): void
  /** The animation names (`keyframes` results) that the rules of the class `className` use. */
  getAnimations(className: string): readonly string[]
  /**
   * The rules of global styles for this cache (see `globalStyles`), with their id and the animations they
   * use; nothing is written. Throws a `TypeError` for styles that are not an object, and for a key that
   * holds no style.
   */
  compileGlobal(styles: GlobalStyleObject): GlobalRules
  /**
   * Writes global rules into the `global` layer (outside every layer without layers), after the
   * `@keyframes` rules of the animations they use, and returns the function that releases them. Rules of
   * one id are written once and counted: each insertion adds one, each release takes one, and at none the
   * rules are removed from the sheet (the `@keyframes` rules stay). Rules that the page has (a server
   * render) are taken over, not written, and removed from the page when released. Rules that cannot be
   * removed (a sheet without `remove`, rules of the page whose place the browser does not show) stay.
   */
  insertGlobal(global: GlobalRules): () => void
  /** `getRules` with every declaration of a theme class, used or not, after the `@property` rules of the registered variables it declares: for a style element that is sent before the rules that use the class. */
  getFullRules(id: string): readonly string[]
  /** The CSS inserted so far and not removed, and the ids it covers (class names, then the global rules held, then the used variables): all of the cache, whatever page asked for it. See `extractPage` for one page. */
  extract(): { css: string; ids: string[] }
  /**
   * The CSS that one page needs, decided from the class names it holds and not from what the cache holds,
   * except for the global rules, which no class stands for: the layer order statement; the `@property`
   * rules of the variables in use; the `@keyframes` rules that the page's classes and the global rules use
   * (and `options.animations`), by name; the rule of the root theme that is in the sheet (the one
   * `insertRoot` was given last, so render and extract one page before the next), then each theme
   * class (of the page, and `options.themes`), each with only
   * the variables the page's rules and the global rules use (all that they refer to, through the values
   * of the themes too, and the variables marked with `markUsed`) and its color-scheme; every global rule
   * the cache holds, in the order they were inserted; and the rules of the classes, in an order that
   * depends on the classes only: a props class after its base class, the rest by name. Names the cache
   * made no rules for are ignored. It reads the cache and changes nothing, so pages rendered at once, or
   * in any order, get the same CSS, apart from the root theme.
   */
  extractPage(
    classNames: Iterable<string>,
    options?: PageExtractOptions
  ): { css: string; ids: string[] }
  /** `extractPage` in two parts: the rules that no class stands for, and the rules of the classes. */
  extractPageParts(classNames: Iterable<string>, options?: PageExtractOptions): PageParts
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
    remove(index) {
      rules.splice(index, 1)
    },
  }
}

/** Deletes `rule` from the style sheet that holds it, found by its place now; a rule that is held by none any more is left. */
function deleteCssRule(rule: CSSRule): void {
  const parent = rule.parentStyleSheet
  if (parent) parent.deleteRule(Array.prototype.indexOf.call(parent.cssRules, rule))
}

/**
 * A sheet in the style element marked `data-style="<key>"`, which it creates when there is none. It keeps
 * the browser's object of each rule it inserts, and removes a rule by finding where that object is at the
 * time, so rules that others insert into or delete from the element do not confuse it.
 */
export function createDomSheet(key: string, container: Node = document.head): Sheet {
  let element = document.querySelector<HTMLStyleElement>(`style[data-style="${key}"]`)
  if (!element) {
    element = document.createElement('style')
    element.dataset.style = key
    container.appendChild(element)
  }
  const sheet = element.sheet as CSSStyleSheet
  const rules: string[] = []
  const objects: CSSRule[] = []
  return {
    rules,
    insert(rule) {
      try {
        const index = sheet.insertRule(rule, sheet.cssRules.length)
        objects.push(sheet.cssRules[index])
        rules.push(rule)
      } catch {
        // A rule the browser rejects is skipped.
      }
    },
    remove(index) {
      rules.splice(index, 1)
      deleteCssRule(objects.splice(index, 1)[0])
    },
  }
}

/**
 * The selector of the style elements that hold engine rules: the cache's own, the ones React hoists for
 * the same prefix, and the `data-umber="<prefix> <ids>"` and `data-umber="<prefix>-global <ids>"` elements
 * of `@umber-style/server` and of an app's own registry.
 */
export function createStyleSelector(prefix: string): string {
  return `style[data-style="${prefix}"], style[data-precedence="${prefix}"], style[data-umber~="${prefix}"], style[data-umber~="${prefix}-global"]`
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

/** Sorts the class names of a class string or sheet entry: a registered class is a style to merge, the rest pass through. */
function sortClassNames(
  value: string | SheetEntry,
  registered: ReadonlyMap<string, StyleObject>,
  styles: StyleObject[],
  rawClasses: string[]
): void {
  for (const name of splitClassNames(value)) {
    const style = registered.get(name)
    if (style) styles.push(style)
    else rawClasses.push(name)
  }
}

/** Orders distinct strings by UTF-16 code unit, what a sort without a compare function does. */
function compareCodeUnits(first: string, second: string): number {
  return first < second ? -1 : 1
}

/** The selector of the rule of the root theme: the document root, with no specificity. */
const ROOT_SELECTOR = ':where(:root)'

/** A root theme that the cache was given: its variables and its color-scheme declaration. */
interface RootTheme {
  declarations: Readonly<Record<string, string>>
  /** The color-scheme declaration, or ''. */
  schemeText: string
}

/** The root theme that is in the sheet: which one, the variables written, and where its rule is. */
interface RootEntry {
  id: string
  written: Set<string>
  /** Where the rule is in the sheet, while it is there. */
  index: number | undefined
}

/** Adds to `names` every variable that the theme values of `themeIds` bring in for a name already in it. */
function addThemeReferences(
  names: Set<string>,
  themeIds: readonly string[],
  readDeclarations: (id: string) => Readonly<Record<string, string>> | undefined
): void {
  const queue = [...names]
  for (const queued of queue) {
    for (const id of themeIds) {
      const value = readDeclarations(id)?.[queued]
      if (value === undefined) continue
      for (const name of scanVariables(value, VARIABLE_START)) {
        if (!names.has(name)) queue.push(name)
        names.add(name)
      }
    }
  }
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
    sortClassNames(value, registered, styles, rawClasses)
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
    hasValueRepair = false,
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
    hasValueRepair,
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

  const layerNames = RULE_LAYERS.map((layer) => `${prefix}-${layer}`).join(',')
  const layerOrder = hasLayers ? `@layer ${layerNames};` : ''
  const layerOrderId = `${prefix}-layers`

  const wrapInLayer = (rules: readonly string[], layer?: RuleLayer): readonly string[] =>
    hasLayers && layer ? rules.map((rule) => `@layer ${prefix}-${layer}{${rule}}`) : rules

  const { onInsert } = options

  // The order statement goes in before the first rule, once; a server render already marked it.
  const insertLayerOrder = (): void => {
    if (hasLayers && !insertedIds.has(layerOrderId)) {
      insertedIds.add(layerOrderId)
      sheet.insert(layerOrder)
      onInsert?.(layerOrderId, layerOrder)
    }
  }

  /** Writes `layered` after the layer order statement, and reports them under `name`. */
  const insertLayered = (name: string, layered: readonly string[]): void => {
    if (layered.length === 0) return
    insertLayerOrder()
    for (const rule of layered) sheet.insert(rule)
    onInsert?.(name, layered.join(''))
    checkLater?.(layered)
  }

  // Pruning: each registered theme class, with what it declares and what of that is written.
  const themes = new Map<string, ThemeEntry>()
  // Every root theme given, by id; the one in the sheet; and the root rules that a server render left in
  // the page, each with the browser's object of the rule when it can be told.
  const roots = new Map<string, RootTheme>()
  let root: RootEntry | undefined
  let pageRoots: (CSSRule | undefined)[] = []

  /** The rule of a root theme with the variables `names`, and its color-scheme; none when that is nothing. */
  const createRootRules = (theme: RootTheme, names: Iterable<string>): readonly string[] => {
    const declared = [...names].map((name): [string, string] => [name, theme.declarations[name]])
    const body = toDeclarationText(declared) + theme.schemeText
    return body === '' ? [] : wrapInLayer([`${ROOT_SELECTOR}{${body}}`], 'theme')
  }

  /** Writes the rule of the root theme anew with every variable written so far, after removing the one it had where the sheet can; a sheet that cannot keeps it, and the new rule, later, wins. */
  const writeRoot = (entry: RootEntry): void => {
    const rules = createRootRules(roots.get(entry.id) as RootTheme, entry.written)
    insertedRules.set(entry.id, rules)
    const { remove } = sheet
    if (entry.index !== undefined && remove) removeAt(remove, entry.index)
    entry.index = undefined
    const before = sheet.rules.length
    // Each rewrite is reported under a name of its own, so that what collects the reports takes it again.
    insertLayered(`${entry.id}-${hashString(rules.join(''))}`, rules)
    if (sheet.rules.length > before) entry.index = sheet.rules.length - 1
  }

  /** Writes `names` for a theme class: a rule of its own, or in place of the rule it has when the sheet can replace. */
  const writeTheme = (className: string, entry: ThemeEntry, names: readonly string[]): void => {
    const added = toDeclarationText(names.map((name) => [name, entry.declarations[name]]))
    const ownScheme = entry.isSent ? '' : entry.schemeText
    const first = entry.isStarted ? '' : ownScheme
    if (added + first === '') return
    // What is added is reported as a rule of its own, whether the sheet replaces the rule or appends.
    const part = wrapInLayer([`.${className}{${added + first}}`], 'theme')
    const reported = entry.isStarted ? `${className}-${hashString(added)}` : className
    entry.isStarted = true
    for (const name of names) entry.written.add(name)
    entry.variables += added
    const { index } = entry
    if (sheet.replace && index !== undefined) {
      const rules = wrapInLayer([`.${className}{${entry.variables + ownScheme}}`], 'theme')
      sheet.replace(index, rules[0])
      entry.rules = rules
      onInsert?.(reported, part[0])
    } else {
      const before = sheet.rules.length
      insertLayered(reported, part)
      if (sheet.replace && sheet.rules.length > before) entry.index = sheet.rules.length - 1
      entry.rules = [...entry.rules, ...part]
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

  // The animation names that the rules of each class use, and the theme that steps of a function are resolved against.
  const animations = new Map<string, readonly string[]>()
  let readKeyframesTheme = (): unknown => {
    throw new Error(
      'keyframes(): these steps are a function of the theme, and this cache has no theme: make the cache through an engine.'
    )
  }

  /** The `@keyframes` rule of `name`: the one written, else made now. */
  const readKeyframesRule = (name: string): string =>
    insertedRules.get(name)?.[0] ??
    createKeyframesRule(name, readKeyframesTheme, hasColorFallbacks, hasValueRepair)

  /** Writes the `@keyframes` rule of the registered `name` once, outside every layer, unless the page has it. */
  const writeKeyframes = (name: string): void => {
    const id = `@keyframes:${name}`
    if (insertedIds.has(id)) return
    const rule = readKeyframesRule(name)
    insertOnce(id, [rule])
    insertedRules.set(name, [rule])
  }

  /** Inserts the rules of a class once, after the `@keyframes` rules of the animations they use. */
  const insertClass = (className: string, rules: readonly string[], layer: ClassLayer): void => {
    if (insertedIds.has(className)) return
    const names = findAnimationNames(rules)
    if (names.length > 0) {
      animations.set(className, names)
      names.forEach(writeKeyframes)
    }
    insertOnce(className, rules, layer)
  }

  const insertKeyframes = (name: string): void => {
    if (!isKeyframesName(name)) {
      throw new TypeError(
        `insertKeyframes(): "${name}" is not a name that keyframes() returned, so there is no rule to write.`
      )
    }
    writeKeyframes(name)
  }

  const markUsed = (names: Iterable<string>): void => {
    if (!hasPruning) return
    const queue = [...names]
    const fresh: string[] = []
    for (const name of queue) {
      if (used.has(name)) continue
      used.add(name)
      fresh.push(name)
      // The value of a token in some theme may refer to another variable, which is then used too.
      for (const { declarations } of [...themes.values(), ...roots.values()]) {
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
    if (root === undefined) return
    const { declarations } = roots.get(root.id) as RootTheme
    const added = fresh.filter((name) => declarations[name] !== undefined)
    if (added.length === 0) return
    for (const name of added) root.written.add(name)
    writeRoot(root)
  }

  const insertRoot = (
    id: string,
    declarations: Readonly<Record<string, string>>,
    colorScheme?: string
  ): void => {
    if (!roots.has(id)) {
      roots.set(id, { declarations, schemeText: colorScheme ? `color-scheme:${colorScheme};` : '' })
      themeNames.set(id, Object.keys(declarations))
    }
    if (root?.id === id) return
    // The rules of the page stand for the root theme of the server; from now on the cache writes it.
    for (const rule of pageRoots) if (rule) deleteCssRule(rule)
    pageRoots = []
    if (root) {
      insertedIds.delete(root.id)
      insertedRules.delete(root.id)
    }
    insertedIds.add(id)
    const names = Object.keys(declarations)
    const isUsed = (name: string) => !hasPruning || used.has(name)
    const entry: RootEntry = { id, written: new Set(names.filter(isUsed)), index: root?.index }
    root = entry
    writeRoot(entry)
    // A value of this theme may refer to a variable that no rule uses yet: marking it writes it.
    markUsed(
      [...entry.written].flatMap((name) => scanVariables(declarations[name], VARIABLE_START))
    )
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
    insertLayered(id, layered)
    if (hasPruning) markUsed(rules.flatMap((rule) => scanVariables(rule, VARIABLE_START)))
    return true
  }

  /** Global rules held, by id, in the order they were inserted: how many hold them, and where they are. */
  interface GlobalEntry {
    count: number
    rules: readonly string[]
    animations: readonly string[]
    /** Where each rule this cache wrote is in the sheet. */
    indexes: number[]
    /** The browser's object of each rule that was taken over from the page (undefined where it cannot be told); none when the rules were written. */
    pageRules: readonly (CSSRule | undefined)[] | undefined
  }
  const globals = new Map<string, GlobalEntry>()
  // The global rules of the page by their text, each with the browser's object of the rule when it can be told.
  const pageGlobals = new Map<string, (CSSRule | undefined)[]>()

  const compileGlobal = (styles: GlobalStyleObject): GlobalRules => {
    const flat = compileGlobalRules(styles, hasColorFallbacks, scoping, hasValueRepair)
    const rules = wrapInLayer(flat, 'global')
    const id = `${prefix}-global-${hashString(rules.join(''))}`
    return { id, rules, animations: findAnimationNames(flat) }
  }

  /** The rules of the page for `rules`, taken so that no other set takes them, when the page has every one of them; else undefined. */
  const takePageRules = (rules: readonly string[]): (CSSRule | undefined)[] | undefined => {
    if (!rules.every((rule) => pageGlobals.get(rule)?.length)) return undefined
    return rules.map((rule) => (pageGlobals.get(rule) as (CSSRule | undefined)[]).shift())
  }

  /** Writes the rules of `global`, or takes them over from the page, after the `@keyframes` rules they use. */
  const writeGlobal = ({ id, rules, animations: names }: GlobalRules): GlobalEntry => {
    names.forEach(writeKeyframes)
    const pageRules = takePageRules(rules)
    const indexes: number[] = []
    // A set with no rules counts as on the page: it writes nothing, not even the layer order.
    if (pageRules === undefined) {
      insertLayerOrder()
      for (const rule of rules) {
        const index = sheet.rules.length
        sheet.insert(rule)
        if (sheet.rules.length > index) indexes.push(index)
      }
      onInsert?.(id, rules.join(''))
      checkLater?.(rules)
    }
    markUsed(rules.flatMap((rule) => scanVariables(rule, VARIABLE_START)))
    const entry: GlobalEntry = { count: 0, rules, animations: names, indexes, pageRules }
    globals.set(id, entry)
    return entry
  }

  /** Removes the rule at `index` of the sheet, and moves down every place the cache keeps that is after it. */
  const removeAt = (remove: (index: number) => void, index: number): void => {
    remove(index)
    for (const entry of globals.values()) {
      entry.indexes = entry.indexes.map((at) => (at > index ? at - 1 : at))
    }
    for (const entry of themes.values()) {
      if (entry.index !== undefined && entry.index > index) entry.index--
    }
    if (root?.index !== undefined && root.index > index) root.index--
  }

  /** Removes the rules of a set that nothing holds any more, unless they cannot be removed: then they stay, and count as written. */
  const removeGlobal = (id: string, entry: GlobalEntry): void => {
    const { pageRules, indexes } = entry
    const { remove } = sheet
    if (pageRules ? pageRules.includes(undefined) : remove === undefined) return
    globals.delete(id)
    pageRules?.forEach((rule) => deleteCssRule(rule as CSSRule))
    for (let at = indexes.length - 1; at >= 0; at--) {
      removeAt(remove as (index: number) => void, indexes[at])
    }
  }

  const insertGlobal = (global: GlobalRules): (() => void) => {
    const entry = globals.get(global.id) ?? writeGlobal(global)
    entry.count++
    let isReleased = false
    return () => {
      if (isReleased) return
      isReleased = true
      entry.count--
      if (entry.count === 0) removeGlobal(global.id, entry)
    }
  }

  const getFullRules = (id: string): readonly string[] => {
    const entry = themes.get(id)
    const properties = (themeNames.get(id) ?? []).flatMap((name) => propertyRules[name] ?? [])
    const rootTheme = roots.get(id)
    if (rootTheme) {
      return [...properties, ...createRootRules(rootTheme, Object.keys(rootTheme.declarations))]
    }
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
    const rules = compileRules('&', merged, hasColorFallbacks, scoping, hasValueRepair)
    if (rules.length === 0) return rawClasses.join(' ')
    const className = nameClass(layer, merged, rules, after)
    registered.set(className, merged)
    if (after !== '') afters.set(className, after)
    insertClass(
      className,
      compileRules(`.${className}`, merged, hasColorFallbacks, scoping, hasValueRepair),
      layer
    )
    return [...rawClasses, className].join(' ')
  }

  const cssIn = (layer: ClassLayer, ...values: ClassValue[]): string =>
    cssWith({ layer }, ...values)

  const createEntry = (style: WebStyleObject): SheetEntry => {
    const merged = mergeStyles([style as StyleObject])
    const rules = compileRules('&', merged, hasColorFallbacks, scoping, hasValueRepair)
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
          insertClass(
            name,
            compileRules(`.${name}`, merged, hasColorFallbacks, scoping, hasValueRepair),
            role
          )
        }
        return name
      },
    }
    const entry = createSheetEntry(nameFor('components'), source)
    entries.set(nameFor('components'), entry)
    return entry
  }

  /** Takes in what rules on the page say: the classes, the layer order, the `@property` and `@keyframes` rules and the themes that are written, and the variables the rules use. */
  const absorb = (found: StyleFindings): void => {
    if (found.hasLayerOrder) insertedIds.add(layerOrderId)
    for (const name of found.classes) insertedIds.add(name)
    for (const name of found.keyframes) insertedIds.add(`@keyframes:${name}`)
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
      const found = scanStyleText(prefix, element.textContent as string)
      absorb(found)
      // The rules of the text are those of the element's sheet, in order, when the browser kept them all.
      const list = (element as HTMLStyleElement).sheet?.cssRules
      const objects = list?.length === found.ruleCount ? list : undefined
      for (const [index, text] of found.globals) {
        const known = pageGlobals.get(text) ?? []
        known.push(objects?.[index])
        pageGlobals.set(text, known)
      }
      for (const index of found.roots) pageRoots.push(objects?.[index])
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

  /** The variables a page needs declared: those its rules (of classes, and `@keyframes` and global rules) refer to, those marked from outside, and what the values of the themes in play refer to. */
  const collectPageVariables = (
    classIds: readonly string[],
    themeIds: readonly string[],
    otherRules: readonly string[]
  ) => {
    const names = new Set(pinned)
    const addVariables = (rule: string): void => {
      for (const name of scanVariables(rule, VARIABLE_START)) names.add(name)
    }
    for (const id of classIds) readRules(id).forEach(addVariables)
    otherRules.forEach(addVariables)
    addThemeReferences(
      names,
      themeIds,
      (id) => themes.get(id)?.declarations ?? roots.get(id)?.declarations
    )
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

  const extractPageParts = (
    classNames: Iterable<string>,
    pageOptions: PageExtractOptions = {}
  ): PageParts => {
    const {
      themes: offered = [],
      animations: named = [],
      carried = new Set<string>(),
    } = pageOptions
    const wanted = new Set([...classNames, ...offered])
    const themeIds = [...wanted].filter((name) => themeNames.has(name)).sort(compareCodeUnits)
    const classIds = [...wanted]
      .filter((name) => name.startsWith(`${prefix}-`) && !themeNames.has(name))
      .filter((name) => insertedRules.has(name))
      .sort((first, second) => (sortKey(first) < sortKey(second) ? -1 : 1))
    const held = [...globals]
    const pageAnimations = [
      ...classIds.flatMap((id) => animations.get(id) ?? []),
      ...held.flatMap(([, entry]) => entry.animations),
    ]
    const keyframesRules = [...new Set([...pageAnimations, ...named])]
      .filter((name) => isKeyframesName(name) && !carried.has(name))
      .sort(compareCodeUnits)
      .map(readKeyframesRule)
    const allGlobalRules = held.flatMap(([, entry]) => entry.rules)
    // The root theme of the page is the one in the sheet: the one that the last render declared.
    const rootIds = root === undefined ? [] : [root.id]
    const allThemeIds = [...rootIds, ...themeIds]
    const names = hasPruning
      ? collectPageVariables(classIds, allThemeIds, [...keyframesRules, ...allGlobalRules])
      : new Set<string>()
    // A carried theme element holds the `@property` rules of the variables its theme declares.
    const covered = new Set(allThemeIds.filter((id) => carried.has(id)).flatMap(readNames))
    const declared = hasPruning ? names : allThemeIds.flatMap(readNames)
    const properties = [...new Set(declared)]
      .filter((name) => propertyRules[name] !== undefined && !covered.has(name))
      .sort(compareCodeUnits)
    const newRoots = rootIds.filter((id) => !carried.has(id))
    const newThemes = themeIds.filter((id) => !carried.has(id))
    const newGlobals = held.filter(([id]) => !carried.has(id))
    const newClasses = classIds.filter((id) => !carried.has(id))
    const rootRules = newRoots.flatMap((id) => {
      const theme = roots.get(id) as RootTheme
      const all = Object.keys(theme.declarations)
      return createRootRules(theme, hasPruning ? all.filter((name) => names.has(name)) : all)
    })
    const themeRules = [...rootRules, ...newThemes.flatMap((id) => createPageThemeRules(id, names))]
    const globalRules = newGlobals.flatMap(([, entry]) => entry.rules)
    const classRules = newClasses.flatMap(readRules)
    const hasLayered = themeRules.length + globalRules.length + classRules.length > 0
    const globalCss = [
      hasLayers && hasLayered ? layerOrder : '',
      ...properties.map((name) => propertyRules[name]),
      ...keyframesRules,
      ...themeRules,
      ...globalRules,
    ].join('')
    return {
      global: { css: globalCss, ids: [...newRoots, ...newThemes, ...newGlobals.map(([id]) => id)] },
      classes: { css: classRules.join(''), ids: newClasses },
    }
  }

  const extractPage = (classNames: Iterable<string>, pageOptions?: PageExtractOptions) => {
    const { global, classes } = extractPageParts(classNames, pageOptions)
    return { css: global.css + classes.css, ids: [...global.ids, ...classes.ids] }
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
    insertRoot,
    registerProperties,
    setKeyframesTheme: (read) => {
      readKeyframesTheme = read
    },
    insertKeyframes,
    getAnimations: (className) => animations.get(className) ?? [],
    compileGlobal,
    insertGlobal,
    insertOnce,
    getRules: (id) => insertedRules.get(id) ?? [],
    getFullRules,
    extract: () => ({
      css: sheet.rules.join(''),
      ids: [...insertedIds, ...globals.keys(), ...used],
    }),
    extractPage,
    extractPageParts,
    fingerprint,
  }
}
