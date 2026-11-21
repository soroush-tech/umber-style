import type { Cache } from './cache'
import { hashString } from './hash'

/** The selector of the rule of the root theme: the document root, with no specificity. */
export const ROOT_SELECTOR = ':where(:root)'

/** The rule `selector{body}` of a theme, inside the theme layer of `prefix` when there are layers. */
export function createThemeRule(
  prefix: string,
  hasLayers: boolean,
  selector: string,
  body: string
): string {
  const rule = `${selector}{${body}}`
  return hasLayers ? `@layer ${prefix}-theme{${rule}}` : rule
}

/** How `createThemeRule` writes the rule of a theme class or of the root theme. */
export interface ThemeRuleOptions {
  /** Sets the color-scheme property in the scope. */
  colorScheme?: 'light' | 'dark' | 'light dark'
}

/** The CSS declarations `name:value;` of `entries`. */
export function toDeclarationText(entries: Iterable<readonly [string, string]>): string {
  let text = ''
  for (const [name, value] of entries) text += `${name}:${value};`
  return text
}

/** The hash of all the declarations of a theme, as text, and of its color-scheme: what names its class or root rule. */
function hashTheme(variables: string, colorScheme?: string): string {
  return hashString(colorScheme ? `${variables}color-scheme:${colorScheme};` : variables)
}

/**
 * The theme class of the declarations `variables` (the text of `toDeclarationText`, as `readThemeText`
 * gives it) and of `colorScheme`, `<prefix>-theme-<hash>`, without registering it: the name that
 * `createThemeClass` gives the same declarations.
 */
export function createThemeId(prefix: string, variables: string, colorScheme?: string): string {
  return `${prefix}-theme-${hashTheme(variables, colorScheme)}`
}

/**
 * Registers the theme class of `declarations` and returns it: the scope of a theme. Its name is the
 * hash of all the declarations, whatever the cache writes of them (see `hasPruning`).
 */
export function createThemeClass(
  cache: Cache,
  declarations: Readonly<Record<string, string>>,
  options: ThemeRuleOptions = {}
): string {
  const { colorScheme } = options
  const variables = toDeclarationText(Object.entries(declarations))
  const className = createThemeId(cache.prefix, variables, colorScheme)
  cache.insertTheme(className, declarations, colorScheme)
  return className
}

/**
 * Makes `declarations` the root theme, the one declared on `:root` (see `Cache.insertRoot`), and returns
 * its id, `<prefix>-root-<hash>`: like a theme class, named by the hash of all its declarations.
 */
export function declareRootTheme(
  cache: Cache,
  declarations: Readonly<Record<string, string>>,
  options: ThemeRuleOptions = {}
): string {
  const { colorScheme } = options
  const variables = toDeclarationText(Object.entries(declarations))
  const id = `${cache.prefix}-root-${hashTheme(variables, colorScheme)}`
  cache.insertRoot(id, declarations, colorScheme)
  return id
}
