import { registerCache } from './cacheRegistry'
import { hashString } from './hash'
import {
  createDevChecker,
  createWarner,
  isDevelopment,
  isProduction,
  warnRenamedOption,
} from './devChecks'
import { findInvalidValues, findUnknownSchemeKeys } from './findInvalidValues'
import { describeClass } from './findUnsupportedDeclarations'
import { createFingerprint, describeFingerprintDifferences } from './fingerprint'
import { compileGlobalRules, type GlobalStyleObject } from './globalStyles'
import { createKeyframesRule, findAnimationNames, isKeyframesName } from './keyframes'
import { scanStyleText, type StyleFindings } from './scanStyleText'
import { readSharedState } from './sharedState'
import {
  createSheetEntry,
  isSheetEntry,
  readEntryStyle,
  readEntrySource,
  type EntryRole,
  type EntrySource,
  type SheetEntry,
} from './sheetEntry'
import {
  compileStyleRules,
  mergeStyles,
  readLabel,
  type CompileContext,
  type StyleObject,
} from './serialize'
import { createThemeRule, ROOT_SELECTOR, toDeclarationText } from './theme'
import { scanVariables } from './variables'
import type { WebStyleObject } from './webStyle'

/**
 * The options of a cache that describe how the author wrote a style, and so how its declarations are
 * written: an engine keeps its own over a cache it is given (`Cache.withStyleOptions`), where the other
 * options of the cache (the names, the layers, the sheet) are the cache's.
 */
export interface StyleOptions {
  /** Whether an `alpha()` value gets a fallback declaration before its color-mix() value (`CacheOptions.hasColorFallbacks`). */
  hasColorFallbacks?: boolean
  /** Whether the string forms of token maths that are never valid CSS are rewritten (`CacheOptions.hasValueRepair`). */
  hasValueRepair?: boolean
  /** Whether a declaration that a supported browser needs in a prefixed form gets that form first (`CacheOptions.hasVendorPrefixes`). */
  hasVendorPrefixes?: boolean
}

/** The options of `createCache`: the names it makes, the layers, the checks, and where its rules go. */
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
   * Whether a declaration that a supported browser still needs in a prefixed form is written after that
   * form, in the same rule: `user-select:none` as `-webkit-user-select:none;user-select:none;` (the
   * table is `PREFIXED_FORMS`, `docs/browser-support.md`). A form the style declares itself is not written
   * again. The class name does not depend on it. Default true; false writes the standard declarations only.
   */
  hasVendorPrefixes?: boolean
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
   * Whether the cache runs the development checks, and warns once for each problem found: in a browser it
   * checks the page (`findMissingStyles`: an engine class that has no rule, a variable that has no value;
   * `CSS.supports`: an inserted declaration that the browser does not support), throttled, after the first
   * render and when rules are inserted; anywhere, it checks each value of a class or of global styles that
   * no CSS property takes (`findInvalidValues`). Default: on in development (`process.env.NODE_ENV` is
   * `development`) where there is a `document`, off otherwise; `true` turns them on in a test run too.
   */
  hasDevChecks?: boolean
  /** A short text that stands for the token options (modes, raw and length keys, registered tokens), for the stamp that the server writes and the browser compares. The engine gives it; '' when none. */
  tokenSignature?: string
  /**
   * Whether the DOM sheet that the cache makes writes its rules with `insertRule` into one style element,
   * which leaves its text empty, rather than each rule as the text of a style element of its own, readable
   * through `textContent` (see `DomSheetOptions`). Default: true when `process.env.NODE_ENV` is
   * `production` and where there is no `process`, false otherwise. Not read when a `sheet` is given. The
   * one boolean option without `is` or `has`: it is the name that apps already pass.
   */
  speedy?: boolean
  /** Where rules go. Default: a DOM sheet when `document` exists, otherwise an in-memory one. */
  sheet?: Sheet
  /**
   * The nonce of a content security policy that allows style elements by nonce (`style-src 'nonce-...'`):
   * set on the style element that the cache makes for its own sheet, and written by `createStyleTag`,
   * `extractPageStyles`, the server package and the bindings into the style elements they make from the
   * cache. It is never part of a rule, a class name or the stamp of the options. Not read when a `sheet`
   * is given: give it to `createDomSheet` then.
   */
  nonce?: string
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
  /** The CSS text of the part. */
  css: string
  /** What the rules of the part stand for: class names, or theme classes and global ids. */
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
  /**
   * The ids of the sets of global rules that the page rendered without a style element (the markers of
   * `Global`). A set that a component inserted (`isRendered`) is part of a page only when the page
   * carries it or names it here; a set inserted for the app is part of every page.
   */
  rendered?: ReadonlySet<string>
}

/** How `insertGlobal` writes a set of global rules. */
export interface GlobalInsertOptions {
  /**
   * Whether a component rendered the set (`Global`), so that it belongs to the pages that render it: a
   * page's CSS (`extractPage`) holds it only when the page carries it or names it in `rendered`. Default
   * false: a set inserted for the app, which is part of every page while it is held.
   */
  isRendered?: boolean
}

/** Where a cache writes its rules: a style element of a document (`createDomSheet`) or memory (`createMemorySheet`). */
export interface Sheet {
  /** Appends one rule, as text. */
  insert(rule: string): void
  /** Every rule inserted so far and not removed, in order. */
  readonly rules: readonly string[]
  /** Replaces the rule inserted at `index` of `rules`; a sheet that cannot (a DOM sheet, in either way of writing) has none, and the cache appends instead. */
  replace?(index: number, rule: string): void
  /**
   * Removes the rule at `index` of `rules`: the rules after it move down by one, in `rules` and in what
   * the sheet holds. A sheet without it keeps every rule: global rules that are released then stay, and
   * count as written, and every class is permanent (see `Cache.cssHeld`).
   */
  remove?(index: number): void
  /**
   * The document whose style elements hold the rules (`createDomSheet` gives the document of its
   * container). The cache reads that document: the style elements a server left there, the stamp of its
   * options, and in development the check of the page. None for a sheet in memory: the cache then reads
   * the global `document`, where there is one.
   */
  readonly document?: Document
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

/** One of the cascade layers of a cache, without its prefix. */
export type RuleLayer = (typeof RULE_LAYERS)[number]

/** The layers that a class can be made in: the styles of a component, and what is given to it from outside. */
export type ClassLayer = 'components' | 'overrides'

/**
 * What a class is made from: a style object, a sheet entry, a class name, a falsy value that is left out,
 * or a list of them, nested to any depth, read in order as if its items were given one by one.
 */
export type ClassValue =
  | WebStyleObject
  | SheetEntry
  | string
  | null
  | undefined
  | false
  | readonly ClassValue[]

/** How `cssWith` makes a class, beyond what is in it. */
export interface ClassOptions {
  /** The layer of the class. Default `components`. */
  layer?: ClassLayer
  /** A label for the class, written first: the labels of the values are joined after it (`Typography-Link`). */
  label?: string
  /**
   * A class of this cache that is written before this one, and that this one is only used with (the base
   * class of a component, for its props class). It is part of the name, so that the same styles after two
   * different classes are two classes, each written after its own; and a sheet entry is merged in, never
   * used as it is, because its own class may have been written before `after`.
   */
  after?: string
}

/** A class that elements hold while they use it (see `Cache.cssHeld`). */
export interface HeldClass {
  /** The class names, as `cssWith` returns them. */
  readonly className: string
  /**
   * Counts one element that uses the class, and returns the function that lets it go (once; a second
   * call does nothing). The same function for every element while the class lives. Undefined when the
   * class is not held: it stays for good.
   */
  readonly hold: (() => () => void) | undefined
}

/** The cache of an engine: it makes class names, writes their rules once, and gives the CSS of a page. */
export interface Cache {
  /** The first part of every class name and variable it makes (`CacheOptions.prefix`). */
  readonly prefix: string
  /** Whether rules go into cascade layers. */
  readonly hasLayers: boolean
  /** The nonce that the style elements made from this cache carry (`CacheOptions.nonce`), or undefined. */
  readonly nonce?: string
  /** The document the cache serves: that of its sheet, else the global one; none on a server. */
  readonly document?: Document
  /** The statement that declares the layers in order, `@layer <prefix>-theme,...;`, or '' without layers. It is the first rule of the sheet. */
  readonly layerOrder: string
  /** The style object of each class this cache made, by class name. */
  readonly registered: ReadonlyMap<string, StyleObject>
  /**
   * One class for all of `values`: style objects, and class names this cache made (resolved back
   * to their styles), merged left to right so the last wins; their labels are joined in that order
   * (see `mergeStyles`). Other class names pass through in front of it. Returns '' when there is
   * nothing. The class is in the `components` layer.
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
  /**
   * `cssWith` for a class that lives only while elements use it: what a styled component is given as a
   * plain object in `style`, so that a value that changes leaves no class behind. The class is written
   * now, as `cssWith` writes it, and `hold` counts each element that uses it. When the count falls to
   * zero, the class is removed after one macrotask (a `setTimeout` of 0), unless it is held again
   * before: its rules leave the sheet, and the class is forgotten (`registered`, `extract`), so the same
   * styles later write it again. A class that is not held within that delay is removed too, so a render
   * that never commits leaves nothing; `hold` writes the class again when it was removed meanwhile.
   *
   * A class that a server render left on the page is taken over: it is not removed before it was held,
   * and at the last release its rules are deleted from the page, unless they cannot all be found there
   * (then they stay). Permanent, with no `hold`: the class of one sheet entry given alone, a class that
   * `cssWith` or an entry made (one that `cssWith` makes later becomes permanent), and every class when
   * the sheet has no `remove`.
   */
  cssHeld(options: Omit<ClassOptions, 'after'>, ...values: ClassValue[]): HeldClass
  /** The entry of a style: its class names are worked out now and their rules are written when the entry is first used, in the layer of how it is used. */
  createEntry(style: WebStyleObject): SheetEntry
  /** The entry that `createEntry` made, by the class name it has when used on its own, for a framework that merged entries into one object. */
  findEntry(className: string): SheetEntry | undefined
  /**
   * This cache's entry for the style of `entry`: `entry` itself when this cache made it (or no cache did:
   * it is only a name), else an entry of this cache for the same style, made once for each entry, so that
   * its rule is written here and not in the cache that made `entry`. The cache does this itself for every
   * entry it is given; a binding calls it for entries that it hands on (a sheet under a cache provider).
   */
  adoptEntry(entry: SheetEntry): SheetEntry
  /** Whether a component's styles are split into a base class and a props class. */
  readonly hasBaseClass: boolean
  /** Whether the development checks are on: given, or by default in development where there is a document. An engine checks what its style functions return when they are. */
  readonly hasDevChecks: boolean
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
  /**
   * Gives the cache what reads the declared value of each variable of a theme, by name (the engine gives
   * those of its base theme), adding to those it has: value repair reads the unit of a token from it, so
   * that `var(--x)px` is the reference alone when `--x` is declared in px. `read` is called the first time
   * value repair needs a value, and only then.
   */
  registerValues(read: () => Readonly<Record<string, string>>): void
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
   * render) are taken over, not written, and removed from the page when released; the style elements
   * that arrived since the page was last read are read first. Rules that cannot be removed (a sheet
   * without `remove`, rules of the page whose place the browser does not show) stay. `options` says whether
   * a component rendered them, which decides the pages they are part of (see `extractPage`).
   */
  insertGlobal(global: GlobalRules, options?: GlobalInsertOptions): () => void
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
   * of the themes too, and the variables marked with `markUsed`) and its color-scheme; the global rules of
   * the page, in the order they were inserted: every set held for the app, and a set that a component
   * rendered when the page carries it or names it in `options.rendered`; and the rules of the classes, in
   * an order that depends on the classes only: a props class after its base class, the rest by name.
   * Names the cache made no rules for are ignored. It reads the cache and changes nothing, so pages
   * rendered at once, or in any order, get the same CSS, apart from the root theme.
   */
  extractPage(
    classNames: Iterable<string>,
    options?: PageExtractOptions
  ): { css: string; ids: string[] }
  /** `extractPage` in two parts: the rules that no class stands for, and the rules of the classes. */
  extractPageParts(classNames: Iterable<string>, options?: PageExtractOptions): PageParts
  /** The options that change the CSS or the class names, as a short text: the server stamps it on its style output and the browser compares it with its own. */
  readonly fingerprint: string
  /**
   * This cache with other style options (see `StyleOptions`): the same sheet, classes, themes and global
   * rules, and the same everything else, but the declarations of what it compiles are written with these
   * options, an option that is not given keeping the cache's own. The same options give the same object;
   * the options of the cache give the cache itself. What an engine uses over a cache it was given.
   */
  withStyleOptions(options: StyleOptions): Cache
}

/** What a message about a `NaN` value adds: where such a value comes from, and the ways out. */
const NAN_HINT =
  ' A NaN often comes from arithmetic on a token in a style function (theme.space[2] * 2), where the token is a reference such as var(--x), not a number: use multiply() or calc(), give the token a raw or inline mode (modes), or read the real value from useTheme().'

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

/** The style options that a compile of a cache uses, every one set, with what is made from them once. */
interface WrittenAs extends Required<StyleOptions> {
  /** What the compiler is given for the rules a class is named from: no prefixed form, so that the name is the same with them or without. */
  readonly naming: CompileContext
  /** What the compiler is given for a text that nothing writes. */
  readonly plain: CompileContext
  /** What the compiler is given for rules that are written: what value repair leaves is reported. */
  readonly reported: CompileContext
  /** Makes an entry of another cache one of this cache, written with these options. */
  readonly adopt: (entry: SheetEntry) => SheetEntry
  /** The merges of class names alone made with these options, by `readMergeKey`, oldest first (see `MergeMemo`). */
  readonly merges: Map<string, MergeMemo>
}

/**
 * A class that `cssWith` made of class names alone, and what it was made from: the names, and the style
 * of each in `registered` at that time (undefined for a name that is not registered). While each name
 * still has that same style and the class is written, the same names make the same class, so it is not
 * merged, compiled and hashed again.
 */
interface MergeMemo {
  readonly names: readonly string[]
  readonly sources: readonly (StyleObject | undefined)[]
  /** The merged style, which `registered` holds for the class. */
  readonly merged: StyleObject
  readonly className: string
  /** What `cssWith` returned: the names that pass through, then the class. */
  readonly result: string
}

/** How many merges of class names a cache remembers for each set of style options; the oldest leaves first. */
const MERGE_LIMIT = 1000

/** The key of a merge of `values` in `merges` when every value is a class string, else undefined. */
function readMergeKey(
  values: readonly ClassValue[],
  layer: ClassLayer,
  label: string | undefined,
  after: string
): string | undefined {
  for (const value of values) if (typeof value !== 'string') return undefined
  return `${layer}\n${label ?? ''}\n${after}\n${values.join(' ')}`
}

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

/** How `createDomSheet` writes its rules. */
export interface DomSheetOptions {
  /**
   * Whether rules are written with `insertRule` into one style element, which is faster and leaves the
   * text empty, rather than each as the text of a style element of its own, so that the `textContent` of
   * the elements (and the element inspector) shows the live rules. Default: true when
   * `process.env.NODE_ENV` is `production` and where there is no `process`, false otherwise.
   */
  speedy?: boolean
  /** Called with a rule that `insertRule` rejected, and the message of the browser; the rule is skipped. Not called for rules written as text, which the browser parses. */
  onReject?: (rule: string, message: string) => void
  /**
   * The nonce of a content security policy, set as the `nonce` attribute of the style element when the
   * sheet makes one, before it goes into the document. An element that the document had is used as it is.
   */
  nonce?: string
}

// How each style element of the engine is written: by text or by `insertRule`, never both, because a
// change of the text of an element parses it again and drops what `insertRule` put in. An element written
// by text holds one rule of a sheet, and no cache reads it as sent by a server. A cache of another copy of
// the core shares these: the text nodes that sheets wrote are recorded too, for a copy of an earlier
// release, which reads an element written by text and leaves those nodes out.
const elementModes = readSharedState(
  'core.element-modes@1',
  () => new WeakMap<Node, 'text' | 'rules'>()
)
const writtenText = readSharedState('core.written-text@1', () => new WeakSet<Node>())

/**
 * The style element `data-style="<key>"` of `owner` that a sheet written as `mode` may use: for text, an
 * empty one that no sheet uses (an element a server filled is left to the server's rules, and an element
 * of another sheet to that sheet); for `insertRule`, any that is not written by text.
 */
function findSheetElement(
  owner: Document,
  key: string,
  mode: 'text' | 'rules'
): HTMLStyleElement | undefined {
  return [...owner.querySelectorAll<HTMLStyleElement>(`style[data-style="${key}"]`)].find(
    (element) => {
      const used = elementModes.get(element)
      if (mode === 'rules') return used !== 'text'
      return used === undefined && element.childNodes.length === 0
    }
  )
}

/** A style element `data-style="<key>"` of `owner`, with `nonce`, not yet in the document. */
function createStyleElement(
  owner: Document,
  key: string,
  nonce: string | undefined
): HTMLStyleElement {
  const element = owner.createElement('style')
  element.dataset.style = key
  // Set before the element is in the document, which is when a policy checks it.
  if (nonce !== undefined) element.setAttribute('nonce', nonce)
  return element
}

/**
 * A sheet that writes each rule as the text of a style element of its own, so that the document parses
 * that rule alone, and never again the rules written before it: the cost of a rule does not grow with the
 * sheet. The first rule goes into `first`; each later one into an element made right after the element of
 * the rule before it, so the rules of the sheet stay together and in order. Removing a rule removes its
 * element, but the last one left keeps its place, empty, for the next rule. It has no `replace`, as a
 * sheet of `insertRule` has none, so that a cache writes the same rules in both ways.
 */
function createTextSheet(
  first: HTMLStyleElement,
  owner: Document,
  key: string,
  nonce: string | undefined
): Sheet {
  const rules: string[] = []
  const elements: HTMLStyleElement[] = []
  // While the sheet holds no rule: the empty element that keeps the place of its rules.
  let anchor: HTMLStyleElement | undefined = first
  return {
    rules,
    document: owner,
    insert(rule) {
      const node = owner.createTextNode(rule)
      writtenText.add(node)
      if (anchor === undefined) {
        const element = createStyleElement(owner, key, nonce)
        elementModes.set(element, 'text')
        // The text goes in before the element is in the document, which then parses it once.
        element.appendChild(node)
        ;(elements.at(-1) as HTMLStyleElement).after(element)
        elements.push(element)
      } else {
        anchor.appendChild(node)
        elements.push(anchor)
        anchor = undefined
      }
      rules.push(rule)
    },
    remove(index) {
      rules.splice(index, 1)
      const [element] = elements.splice(index, 1)
      if (elements.length > 0) {
        element.remove()
        return
      }
      element.replaceChildren()
      anchor = element
    },
  }
}

/** The selector of the innermost rule of `rule`, the first one: `.a` of `@layer x{.a{color:red;}}`. */
function readRuleSelector(rule: string): string {
  const head = rule.slice(0, rule.indexOf('}')).split('{')
  return (head.at(-2) ?? rule).trim()
}

/** A sheet that writes with `insertRule`: it keeps the browser's object of each rule, and removes a rule by finding where that object is at the time. */
function createRuleSheet(
  element: HTMLStyleElement,
  owner: Document,
  onReject: DomSheetOptions['onReject']
): Sheet {
  const sheet = element.sheet as CSSStyleSheet
  const rules: string[] = []
  const objects: CSSRule[] = []
  return {
    rules,
    document: owner,
    insert(rule) {
      try {
        const index = sheet.insertRule(rule, sheet.cssRules.length)
        objects.push(sheet.cssRules[index])
        rules.push(rule)
      } catch (error) {
        // A rule the browser rejects is skipped.
        onReject?.(rule, (error as Error).message)
      }
    },
    remove(index) {
      rules.splice(index, 1)
      deleteCssRule(objects.splice(index, 1)[0])
    },
  }
}

/**
 * A sheet in the style elements marked `data-style="<key>"` of the document of `container`. Without
 * `speedy` each rule is the text of an element of its own, kept as it is given (the browser drops a
 * rule it rejects when it parses the text): the first element is an empty one of the document that no
 * sheet uses, else one it creates in `container`, and the next ones follow it. With it, a rule goes in
 * with `insertRule` into the element of the key that is not written by text, created in `container` when
 * there is none, and one the browser rejects is skipped. Rules that others insert into or delete from an
 * element do not confuse it. Its `document` is that document: a cache over it reads that one (an
 * iframe's, for a container in the iframe). An element it makes carries `options.nonce`, so that a policy
 * that allows style elements by nonce allows it.
 */
export function createDomSheet(
  key: string,
  container: Node = document.head,
  options: DomSheetOptions = {}
): Sheet {
  warnRenamedOption(key, options)
  const { speedy = isProduction(), onReject, nonce } = options
  const mode = speedy ? 'rules' : 'text'
  const owner = container.ownerDocument as Document
  let element = findSheetElement(owner, key, mode)
  if (!element) {
    element = createStyleElement(owner, key, nonce)
    container.appendChild(element)
  }
  elementModes.set(element, mode)
  return speedy
    ? createRuleSheet(element, owner, onReject)
    : createTextSheet(element, owner, key, nonce)
}

/**
 * The selector of the style elements that hold engine rules: the cache's own, the ones React hoists for
 * the same prefix, and the `data-umber="<prefix> <ids>"` and `data-umber="<prefix>-global <ids>"` elements
 * of `@umber-style/server` and of an app's own registry.
 */
export function createStyleSelector(prefix: string): string {
  return `style[data-style="${prefix}"], style[data-precedence="${prefix}"], style[data-umber~="${prefix}"], style[data-umber~="${prefix}-global"]`
}

/** The stamp of the options that the server wrote in `page`: on a style element, or on the `<meta>` that a server component renders. */
function readServerStamp(page: Document, prefix: string): string | undefined {
  const element = page.querySelector<HTMLElement>(
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

/**
 * The CSS text of the style of an entry from its rules compiled for `&`: the body of the rule of its
 * declarations, then the other rules as they are (`&:hover{...}`, `@media (...){&{...}}`).
 */
function toEntryStyles(rules: readonly string[]): string {
  const [first = '', ...rest] = rules
  return first.startsWith('&{') ? first.slice(2, -1) + rest.join('') : rules.join('')
}

/** Orders distinct strings by UTF-16 code unit, what a sort without a compare function does. */
function compareCodeUnits(first: string, second: string): number {
  return first < second ? -1 : 1
}

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

/** What `sortClassValues` finds: the styles to merge, the class names to pass through, and the entries. */
interface SortedValues {
  styles: StyleObject[]
  rawClasses: string[]
  /** The source of the last entry among the values. */
  entry: EntrySource | undefined
  /** The entry when the one style is its own, set once every value is read. */
  sole: EntrySource | undefined
  /** Told about each value that is left out because it is not a style. */
  report: ((value: unknown) => void) | undefined
}

/** Whether `value` is not a style, a class name or an entry (a number, `true`, a function): it is left out, and `report` is told. */
function isLeftOut(value: unknown, report: ((value: unknown) => void) | undefined): boolean {
  if (typeof value === 'string' || isSheetEntry(value)) return false
  report?.(value)
  return true
}

/** Adds `items` to `sorted`, in order, a list read item by item (see `sortClassValues`). */
function addClassValues(
  items: readonly ClassValue[],
  registered: ReadonlyMap<string, StyleObject>,
  adopt: (entry: SheetEntry) => SheetEntry,
  sorted: SortedValues
): void {
  for (const value of items) {
    if (!value) continue
    if (Array.isArray(value)) {
      addClassValues(value as readonly ClassValue[], registered, adopt, sorted)
      continue
    }
    if (typeof value === 'object' && !isSheetEntry(value)) {
      sorted.styles.push(value as StyleObject)
      continue
    }
    if (isLeftOut(value, sorted.report)) continue
    const source = typeof value === 'string' ? undefined : readEntrySource(adopt(value))
    if (source) {
      sorted.styles.push(source.style)
      sorted.entry = source
      continue
    }
    sortClassNames(value, registered, sorted.styles, sorted.rawClasses)
  }
}

/**
 * Splits `values` into the styles to merge (the style of an entry a cache made, registered classes
 * resolved back) and the class names to pass through; a list among them is read in order, as if its items
 * were given one by one. `sole` is the entry when the one style is its own; an entry of another cache is
 * first made this cache's own with `adopt`.
 */
function sortClassValues(
  values: readonly ClassValue[],
  registered: ReadonlyMap<string, StyleObject>,
  adopt: (entry: SheetEntry) => SheetEntry,
  report?: (value: unknown) => void
): SortedValues {
  const sorted: SortedValues = {
    styles: [],
    rawClasses: [],
    entry: undefined,
    sole: undefined,
    report,
  }
  addClassValues(values, registered, adopt, sorted)
  if (sorted.styles.length === 1) sorted.sole = sorted.entry
  return sorted
}

/** The document a cache serves: that of its sheet, else the global one where there is one. */
function readPage(options: CacheOptions): Document | undefined {
  if (options.sheet?.document) return options.sheet.document
  return typeof document === 'undefined' ? undefined : document
}

/** Throws when the page was written by a server whose engine was set up differently: its stamp says how. */
function assertServerStamp(page: Document, prefix: string, fingerprint: string): void {
  const stamp = readServerStamp(page, prefix)
  if (stamp === undefined) return
  const difference = describeFingerprintDifferences(stamp, fingerprint)
  if (difference !== '') throw new Error(difference)
}

/** The sheet a cache makes for itself: in the head of its page, its element with `nonce`, else in memory; a rule the browser rejects is told to `warn`. */
function createOwnSheet(
  prefix: string,
  page: Document | undefined,
  { speedy, nonce }: Pick<CacheOptions, 'speedy' | 'nonce'>,
  warn: ((key: string, message: string) => void) | undefined
): Sheet {
  const onReject = warn
    ? (rule: string, reason: string) => {
        const message = `the browser rejected the rule of ${readRuleSelector(rule)} (${reason}): it is left out.`
        warn(message, message)
      }
    : undefined
  return page ? createDomSheet(prefix, page.head, { speedy, onReject, nonce }) : createMemorySheet()
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
    hasVendorPrefixes = true,
    hasScope = true,
    hasBaseClass = true,
  } = options
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error(`Invalid cache prefix "${prefix}": use lowercase letters, digits and hyphens.`)
  }
  warnRenamedOption(prefix, options)
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
    hasVendorPrefixes,
    tokens: options.tokenSignature ?? '',
  })
  const page = readPage(options)
  if (page) assertServerStamp(page, prefix, fingerprint)
  const { hasDevChecks = page !== undefined && isDevelopment() } = options
  // The label of a class, for a message: the label of the style it was made from.
  const readClassLabel = (className: string): string => readLabel(registered.get(className) ?? {})
  // The page is checked where there is one; a value is checked without one too (a test, a server).
  const checkLater =
    hasDevChecks && page ? createDevChecker(prefix, undefined, page, readClassLabel) : undefined
  const warnValue = hasDevChecks ? createWarner(prefix) : undefined
  /** Warns about each value of `style` that no CSS property takes, and each `@scheme` key that names no scheme, named by `owner`. */
  const reportValues = (owner: string, style: StyleObject): void => {
    const warn = warnValue as (key: string, message: string) => void
    for (const { key, kind } of findInvalidValues(style)) {
      // NaN is what arithmetic on a token gives in a style function, where the token is a reference.
      const hint = kind === 'NaN' ? NAN_HINT : ''
      const message = `${owner} declares "${key}" as ${kind}, which is never a CSS value: give a string or a number.${hint}`
      warn(message, message)
    }
    for (const key of findUnknownSchemeKeys(style)) {
      const message = `${owner} has the key "${key}": a color scheme is light or dark, so it is written as an at-rule that the browser does not know, and drops. Use whenScheme('light') or whenScheme('dark').`
      warn(message, message)
    }
  }
  /** With the development checks, what tells about a value given to `css` that is not a style, for a class labelled `label`. */
  const createLeftOutReporter = (label: string | undefined) => {
    if (warnValue === undefined) return undefined
    const owner = label ? ` for "${label}"` : ''
    return (value: unknown): void => {
      const shown = typeof value === 'function' ? 'a function' : String(value)
      const message = `css() was given ${shown}${owner}, which is not a style: it is left out. Give a style object, a css() value, a class name, or a list of them.`
      warnValue(message, message)
    }
  }
  // The ids of what is written, or was found on the page: class names, the layer order, `@property` rules.
  const insertedIds = new Set<string>()
  const used = new Set<string>()
  // The variables that were marked from outside the engine's own rules: always part of a page's themes.
  const pinned = new Set<string>()
  // The theme classes that the page has rules for, and the variables each of them declares there.
  const pageThemes = new Map<string, Set<string>>()
  // The class a props class was made after (its base class), by class name.
  const afters = new Map<string, string>()
  const sheet = options.sheet ?? createOwnSheet(prefix, page, options, warnValue)
  const registered = new Map<string, StyleObject>()
  const entries = new Map<string, SheetEntry>()
  const scoping = { prefix, hasScope }

  const insertedRules = new Map<string, readonly string[]>()
  // The declared value of each variable of the themes of the engines over this cache, for value repair.
  // They are read when value repair first needs one: a cache that repairs nothing never makes them.
  const tokenValues = new Map<string, string>()
  const pendingValues: (() => Readonly<Record<string, string>>)[] = []
  const registerValues = (read: () => Readonly<Record<string, string>>): void => {
    pendingValues.push(read)
  }
  const readValue = (name: string): string | undefined => {
    for (const read of pendingValues.splice(0)) {
      for (const [variable, value] of Object.entries(read())) tokenValues.set(variable, value)
    }
    return tokenValues.get(name)
  }
  // A reference followed by a unit that value repair leaves is warned about with the development checks.
  const reportRepair = warnValue
    ? (message: string) => (warnValue as (key: string, message: string) => void)(message, message)
    : undefined
  /** The style options `options` with what the compiler is given for them, made once. */
  const toWrittenAs = (options: Required<StyleOptions>): WrittenAs => {
    const plain: CompileContext = { ...options, scoping, readValue }
    const written: WrittenAs = {
      ...options,
      plain,
      naming: { ...plain, hasVendorPrefixes: false },
      reported: { ...plain, report: reportRepair },
      adopt: (entry) => adoptEntry(entry, written),
      merges: new Map(),
    }
    return written
  }
  const own = toWrittenAs({ hasColorFallbacks, hasValueRepair, hasVendorPrefixes })
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

  /** Writes `layered` after the layer order statement, and reports them under `name`; with `indexes`, the place of each rule that the sheet took is added to it. */
  const insertLayered = (name: string, layered: readonly string[], indexes?: number[]): void => {
    if (layered.length === 0) return
    insertLayerOrder()
    if (indexes) {
      for (const rule of layered) {
        const index = sheet.rules.length
        sheet.insert(rule)
        if (sheet.rules.length > index) indexes.push(index)
      }
    } else for (const rule of layered) sheet.insert(rule)
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
    return body === '' ? [] : [createThemeRule(prefix, hasLayers, ROOT_SELECTOR, body)]
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

  /** The `@keyframes` rule of `name`: the one written, else made now, written as `written` says. */
  const readKeyframesRule = (name: string, written: WrittenAs = own): string =>
    insertedRules.get(name)?.[0] ?? createKeyframesRule(name, readKeyframesTheme, written.reported)

  /** Writes the `@keyframes` rule of the registered `name` once, outside every layer, unless the page has it. */
  const writeKeyframes = (name: string, written: WrittenAs): void => {
    const id = `@keyframes:${name}`
    if (insertedIds.has(id)) return
    const rule = readKeyframesRule(name, written)
    insertOnce(id, [rule])
    insertedRules.set(name, [rule])
  }

  /** Inserts the rules of a class once, after the `@keyframes` rules of the animations they use (written as `written` says); with `indexes`, the places of its rules are added to it. */
  const insertClass = (
    className: string,
    rules: readonly string[],
    layer: ClassLayer,
    written: WrittenAs,
    indexes?: number[]
  ): void => {
    if (insertedIds.has(className)) return
    const names = findAnimationNames(rules)
    if (names.length > 0) {
      animations.set(className, names)
      for (const name of names) writeKeyframes(name, written)
    }
    insertOnce(className, rules, layer, indexes)
  }

  const insertKeyframes = (name: string, written: WrittenAs): void => {
    if (!isKeyframesName(name)) {
      throw new TypeError(
        `insertKeyframes(): "${name}" is not a name that keyframes() returned, so there is no rule to write.`
      )
    }
    writeKeyframes(name, written)
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

  function insertOnce(
    id: string,
    rules: readonly string[],
    layer?: RuleLayer,
    indexes?: number[]
  ): boolean {
    if (insertedIds.has(id)) return false
    insertedIds.add(id)
    const layered = wrapInLayer(rules, layer)
    insertedRules.set(id, layered)
    insertLayered(id, layered, indexes)
    if (hasPruning) markUsed(rules.flatMap((rule) => scanVariables(rule, VARIABLE_START)))
    return true
  }

  /** Global rules held, by id, in the order they were inserted: how many hold them, and where they are. */
  interface GlobalEntry {
    count: number
    /** How many of the insertions that hold the set are for the app (not `isRendered`): while there is one, the set is part of every page. */
    appCount: number
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
  // Reads the style elements that arrived on the page and that the watch has not reported yet; nothing to read without a page.
  let readArrived = (): void => undefined

  /** A class that elements hold (see `cssHeld`): how many, and where its rules are. */
  interface HeldEntry {
    count: number
    /** Where each rule this cache wrote is in the sheet; none when the rules are the page's. */
    indexes: number[]
    /** How many rules the class has, when they are the page's (a server render): none were written. */
    pageRules: number | undefined
    /** The `hold` of the class, the same function while the class lives, so that a binding can compare it. */
    hold: () => () => void
  }
  const held = new Map<string, HeldEntry>()
  // The held classes to remove after the delay, if nothing holds them then.
  const releasing = new Set<string>()

  const compileGlobal = (styles: GlobalStyleObject, written: WrittenAs): GlobalRules => {
    const flat = compileGlobalRules(styles, written.reported)
    if (warnValue) reportGlobalValues(styles)
    const rules = wrapInLayer(flat, 'global')
    const id = `${prefix}-global-${hashString(rules.join(''))}`
    return { id, rules, animations: findAnimationNames(flat) }
  }

  /** Warns about the values of global styles that no CSS property takes, named by the key they are under (as the browser check names a global rule). */
  const reportGlobalValues = (styles: GlobalStyleObject): void => {
    for (const [key, value] of Object.entries(styles)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        const style = readEntryStyle(item, 'globalStyles') as StyleObject | null | undefined | false
        if (style) reportValues(`the global rule ${key}`, style)
      }
    }
  }

  /** Whether the page has every one of `rules`, not taken by another set. */
  const hasPageRules = (rules: readonly string[]): boolean =>
    rules.every((rule) => pageGlobals.get(rule)?.length)

  /** The rules of the page for `rules`, taken so that no other set takes them, when the page has every one of them; else undefined. */
  const takePageRules = (rules: readonly string[]): (CSSRule | undefined)[] | undefined => {
    if (!hasPageRules(rules)) return undefined
    return rules.map((rule) => (pageGlobals.get(rule) as (CSSRule | undefined)[]).shift())
  }

  /** Writes the rules of `global`, or takes them over from the page, after the `@keyframes` rules they use. */
  const writeGlobal = (
    { id, rules, animations: names }: GlobalRules,
    written: WrittenAs
  ): GlobalEntry => {
    for (const name of names) writeKeyframes(name, written)
    // A style element that React put in the head in this commit is not read yet: the watch reports it
    // after the commit, so what it has noticed is read now.
    if (!hasPageRules(rules)) readArrived()
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
    const entry: GlobalEntry = {
      count: 0,
      appCount: 0,
      rules,
      animations: names,
      indexes,
      pageRules,
    }
    globals.set(id, entry)
    return entry
  }

  /** Removes the rule at `index` of the sheet, and moves down every place the cache keeps that is after it. */
  const removeAt = (remove: (index: number) => void, index: number): void => {
    remove(index)
    for (const entry of [...globals.values(), ...held.values()]) {
      entry.indexes = entry.indexes.map((position) => (position > index ? position - 1 : position))
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
    for (let position = indexes.length - 1; position >= 0; position--) {
      removeAt(remove as (index: number) => void, indexes[position])
    }
  }

  const insertGlobal = (
    written: WrittenAs,
    global: GlobalRules,
    { isRendered = false }: GlobalInsertOptions = {}
  ): (() => void) => {
    const { id } = global
    const entry = globals.get(id) ?? writeGlobal(global, written)
    const forApp = isRendered ? 0 : 1
    entry.count++
    entry.appCount += forApp
    let isReleased = false
    return () => {
      if (isReleased) return
      isReleased = true
      entry.count--
      entry.appCount -= forApp
      if (entry.count === 0) removeGlobal(id, entry)
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
    return [...properties, ...(body ? [createThemeRule(prefix, hasLayers, `.${id}`, body)] : [])]
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

  /** The merged style of `styles` (the label first) and the name of its class, compiled as `written` says; undefined when it has no rule. */
  const prepareClass = (
    layer: ClassLayer,
    label: string | undefined,
    after: string,
    styles: readonly StyleObject[],
    written: WrittenAs
  ): { merged: StyleObject; className: string } | undefined => {
    if (styles.length === 0) return undefined
    const merged = mergeStyles(label ? [{ label }, ...styles] : styles)
    const rules = compileStyleRules('&', merged, written.naming)
    if (rules.length === 0) return undefined
    return { merged, className: nameClass(layer, merged, rules, after) }
  }

  /** The rules of the class `className` with the style `merged`, as `written` says; with the development checks, its values are checked first. */
  const compileClass = (
    className: string,
    merged: StyleObject,
    written: WrittenAs
  ): readonly string[] => {
    if (warnValue) reportValues(describeClass(className, readLabel(merged)), merged)
    return compileStyleRules(`.${className}`, merged, written.reported)
  }

  /** Registers the class `className` of the style `merged` for good, made after `after`, and writes it when it is not written. */
  const registerClass = (
    className: string,
    merged: StyleObject,
    layer: ClassLayer,
    after: string,
    written: WrittenAs
  ): void => {
    // A held class that is made here for good is held no more.
    if (held.size > 0) held.delete(className)
    registered.set(className, merged)
    if (after !== '') afters.set(className, after)
    // A class that is written already gets no rules: they are compiled only to be written, and
    // `insertClass` writes nothing for it. With the development checks they still are, for the check.
    if (warnValue || !insertedIds.has(className)) {
      insertClass(className, compileClass(className, merged, written), layer, written)
    }
  }

  /** The merge remembered under `key`, when each of its names still has the style it had then and its class is written. */
  const findMerge = (written: WrittenAs, key: string | undefined): MergeMemo | undefined => {
    if (key === undefined) return undefined
    const memo = written.merges.get(key)
    if (memo === undefined || !insertedIds.has(memo.className)) return undefined
    const { names, sources } = memo
    for (let index = 0; index < names.length; index++) {
      if (registered.get(names[index]) !== sources[index]) return undefined
    }
    return memo
  }

  /** Remembers the merge of the class strings `values` under `key`, with the styles its names have now; the oldest leaves past `MERGE_LIMIT`. */
  const rememberMerge = (
    written: WrittenAs,
    key: string,
    values: readonly string[],
    made: Omit<MergeMemo, 'names' | 'sources'>
  ): void => {
    const { merges } = written
    merges.delete(key)
    if (merges.size >= MERGE_LIMIT) merges.delete(merges.keys().next().value as string)
    const names = values.flatMap((value) => splitClassNames(value))
    merges.set(key, { ...made, names, sources: names.map((name) => registered.get(name)) })
  }

  const cssWith = (written: WrittenAs, options: ClassOptions, values: ClassValue[]): string => {
    const { layer = 'components', label, after = '' } = options
    // With the development checks every call is checked, so no merge is taken as remembered.
    const key = warnValue ? undefined : readMergeKey(values, layer, label, after)
    const memo = findMerge(written, key)
    if (memo) {
      registerClass(memo.className, memo.merged, layer, after, written)
      return memo.result
    }
    const { adopt } = written
    const report = createLeftOutReporter(label)
    const { styles, rawClasses, sole } = sortClassValues(values, registered, adopt, report)
    if (sole && after === '') return [...rawClasses, sole.use(layer)].filter(Boolean).join(' ')
    const prepared = prepareClass(layer, label, after, styles, written)
    if (prepared === undefined) return rawClasses.join(' ')
    const { merged, className } = prepared
    registerClass(className, merged, layer, after, written)
    const result = [...rawClasses, className].join(' ')
    if (key !== undefined) {
      rememberMerge(written, key, values as string[], { merged, className, result })
    }
    return result
  }

  /**
   * Registers and writes the held class `className`, or takes it over from the page when the page has
   * it. A class written by this cache is removed after the delay unless it is held by then.
   */
  const writeHeld = (
    className: string,
    merged: StyleObject,
    layer: ClassLayer,
    written: WrittenAs
  ): HeldEntry => {
    const rules = compileClass(className, merged, written)
    const isPage = insertedIds.has(className)
    const entry: HeldEntry = {
      count: 0,
      indexes: [],
      pageRules: isPage ? rules.length : undefined,
      hold: () => {
        let holder = held.get(className)
        if (holder === undefined) {
          // Made permanent meanwhile, or removed before this element held it.
          if (registered.has(className)) return () => undefined
          holder = writeHeld(className, merged, layer, written)
        }
        const current = holder
        current.count++
        let isReleased = false
        return () => {
          if (isReleased) return
          isReleased = true
          current.count--
          if (current.count === 0) scheduleRelease(className)
        }
      },
    }
    held.set(className, entry)
    registered.set(className, merged)
    insertClass(className, rules, layer, written, entry.indexes)
    if (!isPage) scheduleRelease(className)
    return entry
  }

  /** The rules of the page (the style elements of the engine) that name the class `className`, when there are `count` of them; else undefined. */
  const findPageRules = (className: string, count: number): CSSRule[] | undefined => {
    const escaped = className.replaceAll(/[^\w-]/g, String.raw`\$&`)
    const pattern = new RegExp(String.raw`\.${escaped}(?![\w-])`)
    const found: CSSRule[] = []
    for (const element of (page as Document).querySelectorAll<HTMLStyleElement>(
      createStyleSelector(prefix)
    )) {
      for (const rule of element.sheet?.cssRules ?? []) {
        if (pattern.test(rule.cssText)) found.push(rule)
      }
    }
    return found.length === count ? found : undefined
  }

  /** Removes a held class that nothing holds: its rules from the sheet, or from the page when they are the page's and can all be found; then the class is forgotten. Rules that cannot be found stay, and the class is permanent. */
  const removeHeld = (className: string, entry: HeldEntry): void => {
    held.delete(className)
    if (entry.pageRules === undefined) {
      for (let position = entry.indexes.length - 1; position >= 0; position--) {
        removeAt(sheet.remove as (index: number) => void, entry.indexes[position])
      }
    } else {
      const rules = findPageRules(className, entry.pageRules)
      if (rules === undefined) return
      rules.forEach(deleteCssRule)
    }
    registered.delete(className)
    insertedIds.delete(className)
    insertedRules.delete(className)
    animations.delete(className)
  }

  /** Removes each held class that waits for its removal and that nothing holds any more. */
  const flushReleases = (): void => {
    for (const className of releasing) {
      const entry = held.get(className)
      if (entry?.count === 0) removeHeld(className, entry)
    }
    releasing.clear()
  }

  /** Marks `className` for removal after the delay: one macrotask, so that a class let go and held again in the same task (a commit, a value that comes straight back) stays. */
  const scheduleRelease = (className: string): void => {
    releasing.add(className)
    if (releasing.size === 1) setTimeout(flushReleases, 0)
  }

  const cssHeld = (
    written: WrittenAs,
    options: Omit<ClassOptions, 'after'>,
    values: ClassValue[]
  ): HeldClass => {
    const { layer = 'components', label } = options
    const { adopt } = written
    const report = createLeftOutReporter(label)
    const { styles, rawClasses, sole } = sortClassValues(values, registered, adopt, report)
    if (sole || sheet.remove === undefined) {
      return { className: cssWith(written, options, values), hold: undefined }
    }
    const prepared = prepareClass(layer, label, '', styles, written)
    if (prepared === undefined) return { className: rawClasses.join(' '), hold: undefined }
    const { merged, className: name } = prepared
    const className = [...rawClasses, name].join(' ')
    let entry = held.get(name)
    if (entry === undefined) {
      // A class that is registered and not held is permanent.
      if (registered.has(name)) return { className, hold: undefined }
      entry = writeHeld(name, merged, layer, written)
    }
    return { className, hold: entry.hold }
  }

  const createEntry = (style: WebStyleObject, written: WrittenAs): SheetEntry => {
    const merged = mergeStyles([style as StyleObject])
    const rules = compileStyleRules('&', merged, written.naming)
    const names: Partial<Record<EntryRole, string>> = {}
    const getRoleName = (role: EntryRole): string => {
      names[role] ??= rules.length === 0 ? '' : nameClass(role, merged, rules, '')
      return names[role]
    }
    const source: EntrySource = {
      style: merged,
      cache: self,
      use(role) {
        const name = getRoleName(role)
        // The class of an entry is permanent, also when the same style was held.
        if (held.size > 0) held.delete(name)
        if (name !== '' && !registered.has(name)) {
          registered.set(name, merged)
          insertClass(name, compileClass(name, merged, written), role, written)
        }
        return name
      },
      // The text has the prefixed forms that the class writes; the name was made without them.
      readStyles: () =>
        toEntryStyles(
          written.hasVendorPrefixes ? compileStyleRules('&', merged, written.plain) : rules
        ),
    }
    const entry = createSheetEntry(getRoleName('components'), source)
    entries.set(getRoleName('components'), entry)
    return entry
  }

  // The entry of this cache made for each entry of another cache, by what that cache gave its entry.
  const adopted = new WeakMap<EntrySource, SheetEntry>()
  const adoptEntry = (entry: SheetEntry, written: WrittenAs): SheetEntry => {
    const source = readEntrySource(entry)
    if (source === undefined || source.cache === self) return entry
    let made = adopted.get(source)
    if (made === undefined) {
      made = createEntry(source.style as WebStyleObject, written)
      adopted.set(source, made)
    }
    return made
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

  if (page) {
    // The page is read once here, and again for every style element that arrives later.
    const selector = createStyleSelector(prefix)
    const scanned = new WeakSet<Element>()
    const scan = (element: Element): void => {
      // An element written by text holds a rule of a sheet of the engine, never one a server sent: one
      // arrives for each rule such a sheet writes, and costs a lookup here.
      if (elementModes.get(element) === 'text') return
      // A style element of React's stream waits in the body with `media="not all"` until its boundary is
      // revealed, and is then moved to the head, which parses its rules again: it is read there.
      if (scanned.has(element) || element.getAttribute('media') === 'not all') return
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
      // A root rule that arrives after the cache declared its root theme would come after the rule of the
      // cache and win with its old values: it is removed now. Before that, it waits for the declaration.
      const rootRules = found.roots.map((index) => objects?.[index])
      if (root === undefined) pageRoots.push(...rootRules)
      else for (const rule of rootRules) if (rule) deleteCssRule(rule)
    }
    for (const element of page.querySelectorAll(selector)) scan(element)
    // Rules reach the page without a call to the engine: streamed content, a route that a framework
    // fetches. A watch on the children of <head> notices the elements React hoists there, and one on the
    // children of <body> those that a registry streams after the cache started. Before there is a body,
    // the root element is watched for it. A node of another document (an iframe's) is not an instance of
    // this window's `Element`, so the type of the node is read instead.
    const readRecords = (records: readonly MutationRecord[]): void => {
      for (const { addedNodes } of records) {
        for (const node of addedNodes) {
          if (node === page.body) observer.observe(node, { childList: true })
          else if (node.nodeType === 1 && (node as Element).matches(selector)) scan(node as Element)
        }
      }
    }
    const observer = new MutationObserver((records) => {
      readRecords(records)
      checkLater?.()
    })
    observer.observe(page.head, { childList: true })
    observer.observe(page.body ?? page.documentElement, { childList: true })
    readArrived = () => readRecords(observer.takeRecords())
    checkLater?.()
  }

  /** What orders the classes of a page: a props class is right after its base class (its `after`), the rest by name. */
  const readSortKey = (id: string): string =>
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
      rendered = new Set<string>(),
    } = pageOptions
    const wanted = new Set([...classNames, ...offered])
    const themeIds = [...wanted].filter((name) => themeNames.has(name)).sort(compareCodeUnits)
    const classStart = `${prefix}-`
    // The key of each class is made once, not in every comparison; the keys differ, so the order is
    // the one a comparison of the keys gives.
    const classIds = [...wanted]
      .filter((name) => name.startsWith(classStart) && !themeNames.has(name))
      .filter((name) => insertedRules.has(name))
      .map((id): [string, string] => [readSortKey(id), id])
      .sort(([first], [second]) => (first < second ? -1 : 1))
      .map(([, id]) => id)
    // The global rules of this page: those of the app, and those of a component that the page rendered.
    const pageSets = [...globals].filter(
      ([id, entry]) => entry.appCount > 0 || rendered.has(id) || carried.has(id)
    )
    const pageAnimations = [
      ...classIds.flatMap((id) => animations.get(id) ?? []),
      ...pageSets.flatMap(([, entry]) => entry.animations),
    ]
    const keyframesRules = [...new Set([...pageAnimations, ...named])]
      .filter((name) => isKeyframesName(name) && !carried.has(name))
      .sort(compareCodeUnits)
      .map((name) => readKeyframesRule(name))
    const allGlobalRules = pageSets.flatMap(([, entry]) => entry.rules)
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
    const newGlobals = pageSets.filter(([id]) => !carried.has(id))
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

  /** The members of a cache that compile a style, written as `written` says (see `withStyleOptions`). */
  const createCompilers = (written: WrittenAs) => ({
    css: (...values: ClassValue[]) => cssWith(written, {}, values),
    cssIn: (layer: ClassLayer, ...values: ClassValue[]) => cssWith(written, { layer }, values),
    cssWith: (classOptions: ClassOptions, ...values: ClassValue[]) =>
      cssWith(written, classOptions, values),
    cssHeld: (classOptions: Omit<ClassOptions, 'after'>, ...values: ClassValue[]) =>
      cssHeld(written, classOptions, values),
    createEntry: (style: WebStyleObject) => createEntry(style, written),
    adoptEntry: (entry: SheetEntry) => adoptEntry(entry, written),
    compileGlobal: (styles: GlobalStyleObject) => compileGlobal(styles, written),
    insertKeyframes: (name: string) => insertKeyframes(name, written),
    insertGlobal: (global: GlobalRules, insertOptions?: GlobalInsertOptions) =>
      insertGlobal(written, global, insertOptions),
  })

  // The cache with other style options, by those options: made once each.
  const views = new Map<string, Cache>()
  const withStyleOptions = (styleOptions: StyleOptions): Cache => {
    const options: Required<StyleOptions> = {
      hasColorFallbacks: styleOptions.hasColorFallbacks ?? hasColorFallbacks,
      hasValueRepair: styleOptions.hasValueRepair ?? hasValueRepair,
      hasVendorPrefixes: styleOptions.hasVendorPrefixes ?? hasVendorPrefixes,
    }
    const key = Object.values(options).join(':')
    if (key === `${hasColorFallbacks}:${hasValueRepair}:${hasVendorPrefixes}`) return self
    let view = views.get(key)
    if (view === undefined) {
      view = { ...self, ...createCompilers(toWrittenAs(options)) }
      views.set(key, view)
    }
    return view
  }

  const self: Cache = {
    prefix,
    hasLayers,
    nonce: options.nonce,
    document: page,
    layerOrder,
    registered,
    ...createCompilers(own),
    findEntry: (className) => entries.get(className),
    hasBaseClass,
    hasDevChecks,
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
    registerValues,
    setKeyframesTheme: (read) => {
      readKeyframesTheme = read
    },
    getAnimations: (className) => animations.get(className) ?? [],
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
    withStyleOptions,
  }
  // A cache that writes into a style element of a document is the one `findCache` gives for its prefix there.
  if (sheet.document) registerCache(sheet.document, self)
  return self
}
