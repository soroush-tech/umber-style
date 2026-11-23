import type { Cache } from './cache'
import type { SheetEntry } from './sheetEntry'
import type { WebStyleObject } from './webStyle'
import type { TokenOptions } from './tokens'

/** The options of `createEngine`: the token options, and the options of the cache it makes. */
export interface EngineOptions extends TokenOptions {
  /** First part of every class name and variable name. Default 'css'. */
  prefix?: string
  /** Appended to every class name. */
  suffix?: string
  /** Whether a style's label is part of its class name. */
  hasLabels?: boolean
  /** Whether every rule goes into a cascade layer. Default true. */
  hasLayers?: boolean
  /** Whether an `alpha()` value is written as a fallback and then the color-mix() value. Default true; used when the engine makes its cache. */
  hasColorFallbacks?: boolean
  /** Whether the string forms of token maths that are never valid CSS (`var(--x)1F`, `-var(--x)`, `var(--x)ms`) are rewritten in each value. Default false; used when the engine makes its cache. */
  hasValueRepair?: boolean
  /** Whether a declaration that a supported browser still needs in a prefixed form (`user-select`, see `docs/browser-support.md`) is written after that form. Default true; used when the engine makes its cache, and over a cache it is given. */
  hasVendorPrefixes?: boolean
  /** Whether a `when()` or `whenScheme()` style is scoped with `@scope`. Default true; used when the engine makes its cache. Without it the rule is a plain descendant selector, which is wrong for nested themes. */
  hasScope?: boolean
  /** Whether a theme class declares only the variables that rules refer to. Default true; used when the engine makes its cache. */
  hasPruning?: boolean
  /** Whether a component's styles are split by position into a base class (made once) and a props class (made for each render). Default true; used when the engine makes its cache. */
  hasBaseClass?: boolean
  /** Whether the cache remembers the class of a style by its contents (`CacheOptions.hasStyleMemo`). Default false; used when the engine makes its cache. */
  hasStyleMemo?: boolean
  /**
   * Whether the development checks run, each problem warned about once: the cache checks the page in the
   * browser (`findMissingStyles`, and each inserted declaration that `CSS.supports` rejects) and each value
   * that no CSS property takes, and the engine checks what its style functions return. Default: on in
   * development (`process.env.NODE_ENV` is `development`), off otherwise; `true` turns them on in a test
   * run too. The cache takes it when the engine makes one; with a `cache` given, the engine's own checks
   * follow this option, else that cache's.
   */
  hasDevChecks?: boolean
  /**
   * Whether the cache writes its rules with `insertRule` into one style element, rather than each as the
   * text of a style element of its own, readable through `textContent` (see `DomSheetOptions`). Default:
   * true when `process.env.NODE_ENV` is `production`, false otherwise; used when the engine makes its
   * cache. The one boolean option without `is` or `has`: it is the name that apps already pass.
   */
  speedy?: boolean
  /**
   * The nonce of a content security policy that allows style elements by nonce, for the style elements
   * made from the cache (`CacheOptions.nonce`): the browser's sheet, the tags of a server render and the
   * style elements of the bindings. Used when the engine makes its cache.
   */
  nonce?: string
  /** Theme paths (dotted, or top-level keys) whose variables are always declared, for code outside the engine that reads them. */
  alwaysDeclare?: readonly string[]
  /** The cache to use; one is made when not given. */
  cache?: Cache
}

/** The value of the CSS `color-scheme` property that a theme declares: light, dark, or both. */
export type ColorScheme = 'light' | 'dark' | 'light dark'

/**
 * What a style function may return: a style object, nothing, or a list of them, nested to any depth,
 * merged in order as if its items were separate styles.
 */
export type StyleResult = WebStyleObject | null | undefined | false | readonly StyleResult[]

/** A style that is computed from the props and the theme. */
export type StyleFunction<T, P> = (props: P & { theme: T }) => StyleResult

/** A style object, or a function of the props and the theme; the defaults accept any function. */
export type StyleInput<T = never, P = never> = WebStyleObject | StyleFunction<T, P>

/** How a styled component labels its class: a name and a slot, or a label written as it is. */
export interface StylerOptions {
  /** With `slot`, the label of the class: `name-slot` in kebab-case. */
  name?: string
  /** Default 'root'. */
  slot?: string
  /**
   * The label of the class, as it is written: it wins over `name` and `slot`. Like them it is part of the
   * class name only when the cache has `hasLabels` (the default).
   */
  label?: string
}

/** The styles of a sheet, one style object for each name. */
export type SheetStyles = Record<string, WebStyleObject>

/**
 * What a sheet is made from: one style for each name, or a function of the theme that returns them. The
 * names are the type parameter, so that an object literal given here is checked key by key.
 */
export type SheetInput<K extends string, T> =
  | Record<K, WebStyleObject>
  | ((theme: T) => Record<K, WebStyleObject>)

/**
 * A sheet given as an object: one style for each name. It is a record of styles with a function
 * left out, so that a function of the theme is not taken for one (the compiler tries the object form first).
 */
export type ObjectSheet<K extends string> = Record<K, WebStyleObject> & { call?: never }

/** The entries of a sheet, by name: each is made on first access, and its rule is written when it is first used. */
export type SheetEntries<K extends string> = { readonly [P in K]: SheetEntry }

/** A sheet made from a function of the theme: it has no entries until it is resolved against a theme, which `useStyle` does. */
export interface ThemedSheet<K extends string, T> {
  /** The entries, against `theme` (a theme view) when given, else against the base theme. */
  resolve(theme?: T): SheetEntries<K>
}

/**
 * The shape of the theme of an app. It has no members of its own (the optional one below only keeps it
 * from being empty): an app adds its own by merging, with
 * `declare module '@umber-style/core' { interface Theme extends MyTheme {} }`.
 */
export interface Theme {
  readonly _theme?: never
}
