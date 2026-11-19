/** The two color schemes that a condition can name. */
export type SchemeName = 'light' | 'dark'

/** The key of a style that applies when the nearest theme is the one with this theme class: `@theme <themeClass>`. */
export type ThemeKey = `@theme ${string}`

/** The key of a style that applies when the nearest color scheme is this one: `@scheme dark`. */
export type SchemeKey = `@scheme ${SchemeName}`

/** What a condition key stands for. */
export type Condition =
  | { readonly kind: 'theme'; readonly id: string }
  | { readonly kind: 'scheme'; readonly scheme: SchemeName }

/** The names a scope is written with: the prefix of the cache, and whether `@scope` is used. */
export interface Scoping {
  /** The prefix of the cache; the marker classes start with it. */
  readonly prefix: string
  /** Whether a conditional rule is written with `@scope`. Without it, a plain descendant selector. */
  readonly hasScope: boolean
}

/** The scoping of a cache that gave none: the default prefix, with `@scope`. */
export const DEFAULT_SCOPING: Scoping = { prefix: 'css', hasScope: true }

const THEME_KEY = '@theme '
const SCHEME_KEY = '@scheme '

/** The key for "the nearest theme is the one of this theme class". */
export function createThemeKey(themeClass: string): ThemeKey {
  return `${THEME_KEY}${themeClass}`
}

/** The key for "the nearest color scheme is this one". */
export function createSchemeKey(scheme: SchemeName): SchemeKey {
  return `${SCHEME_KEY}${scheme}`
}

/** The condition a style key stands for, or undefined for any other key. */
export function readCondition(key: string): Condition | undefined {
  if (key.startsWith(THEME_KEY)) return { kind: 'theme', id: key.slice(THEME_KEY.length) }
  if (key.startsWith(SCHEME_KEY)) {
    const scheme = key.slice(SCHEME_KEY.length)
    if (scheme === 'light' || scheme === 'dark') return { kind: 'scheme', scheme }
  }
  return undefined
}

/** The class that every element with a theme carries, so that it can be a scope limit. */
export function getBoundaryClass(prefix: string): string {
  return `${prefix}-boundary`
}

/** The class of an element whose theme has a color scheme of its own. */
export function getSchemeClass(prefix: string, scheme: SchemeName): string {
  return `${prefix}-scheme-${scheme}`
}

/**
 * The class string of a theme: its theme class, the boundary marker, and, when its color scheme is
 * `light` or `dark`, the scheme marker. `light dark` and no scheme have no scheme marker.
 */
export function createThemeClassName(prefix: string, id: string, colorScheme?: string): string {
  const scheme = colorScheme === 'light' || colorScheme === 'dark' ? colorScheme : undefined
  return [id, getBoundaryClass(prefix), scheme && getSchemeClass(prefix, scheme)]
    .filter(Boolean)
    .join(' ')
}

/**
 * `rules` for the elements below the elements that match `start`, down to but not into the elements
 * that match `limits`: `@scope (start) to (limits){rules}`. A limit is relative to the scope root, so
 * the root is never cut off by its own marker (checked in a browser: `to (.x)` and `to (:scope .x)` agree).
 */
export function createScopeRule(start: string, limits: string, rules: readonly string[]): string {
  return `@scope (${start}) to (${limits}){${rules.join('')}}`
}

/** The selector that matches an element with no scheme marker on it or above it. Its specificity is 0. */
export function createNoSchemeGuard(prefix: string): string {
  const markers = [getSchemeClass(prefix, 'light'), getSchemeClass(prefix, 'dark')].map(
    (name) => `.${name}`
  )
  return `:where(:not(${[...markers, ...markers.map((marker) => `${marker} *`)].join(',')}))`
}
