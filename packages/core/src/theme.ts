import type { Cache } from './cache'
import { hashString } from './hash'

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
  const body = colorScheme ? `${variables}color-scheme:${colorScheme};` : variables
  const className = `${cache.prefix}-theme-${hashString(body)}`
  cache.insertTheme(className, declarations, colorScheme)
  return className
}
