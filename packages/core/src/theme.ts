import type { Cache } from './cache'
import { hashString } from './hash'

export interface ThemeRuleOptions {
  /** Sets the color-scheme property in the scope. */
  colorScheme?: 'light' | 'dark' | 'light dark'
}

/** Inserts the rule that sets `declarations` under one class, and returns that class: the scope of a theme. */
export function createThemeClass(
  cache: Cache,
  declarations: Readonly<Record<string, string>>,
  options: ThemeRuleOptions = {}
): string {
  const { colorScheme } = options
  const variables = Object.entries(declarations)
    .map(([name, value]) => `${name}:${value};`)
    .join('')
  const body = colorScheme ? `${variables}color-scheme:${colorScheme};` : variables
  const className = `${cache.prefix}-theme-${hashString(body)}`
  cache.insertOnce(className, body ? [`.${className}{${body}}`] : [], 'theme')
  return className
}
