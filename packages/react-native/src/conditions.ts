import { createThemeKey, readCondition, type SchemeName, type ThemeKey } from '@umber-style/core'
import { platformAppearance } from './platform'

/** What a condition key is matched against: the theme object and the color scheme of the nearest provider. */
export interface NativeCondition {
  /** The object given to the `theme` prop of the nearest provider; the base theme when there is none. */
  readonly theme: object | undefined
  /** The color scheme the nearest provider that has one was given; undefined when there is none. */
  readonly colorScheme: SchemeName | undefined
}

const themesById = new Map<string, object>()
const idsByTheme = new WeakMap<object, string>()

/** The key of `when(theme)`: it names the theme object itself, which `matchesCondition` compares by identity. */
export function createNativeThemeKey(theme: object): ThemeKey {
  let id = idsByTheme.get(theme)
  if (id === undefined) {
    id = `n${themesById.size}`
    idsByTheme.set(theme, id)
    themesById.set(id, theme)
  }
  return createThemeKey(id)
}

/** `light` or `dark` as given to a provider; `light dark` and nothing say no scheme of their own. */
export function readSchemeName(colorScheme: string | undefined): SchemeName | undefined {
  return colorScheme === 'light' || colorScheme === 'dark' ? colorScheme : undefined
}

/** Whether the condition key `key` holds for `current`: it is a condition key, and the nearest theme or color scheme is the one it names. */
export function matchesCondition(key: string, current: NativeCondition | undefined): boolean {
  const condition = readCondition(key)
  if (condition === undefined || current === undefined) return false
  if (condition.kind === 'theme') return themesById.get(condition.id) === current.theme
  return (current.colorScheme ?? platformAppearance.getColorScheme()) === condition.scheme
}
