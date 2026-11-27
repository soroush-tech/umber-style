import { readState, type SchemeName, type StateName, type ThemeKey } from '@umber-style/core'
import { createThemeKey, readCondition, readSharedState } from '@umber-style/core/internal'
import { platformAppearance } from './platform'

/** What a condition key is matched against: the theme object and the color scheme of the nearest provider. */
export interface NativeCondition {
  /** The object given to the `theme` prop of the nearest provider; the base theme when there is none. */
  readonly theme: object | undefined
  /** The color scheme the nearest provider that has one was given; undefined when there is none. */
  readonly colorScheme: SchemeName | undefined
}

// The theme of each id that `when(theme)` names, shared by every copy of the binding in the program: the
// ids are counted, so two copies with their own would give one id to two themes.
const { themesById, idsByTheme } = readSharedState('react-native.theme-ids@1', () => ({
  themesById: new Map<string, object>(),
  idsByTheme: new WeakMap<object, string>(),
}))

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

/**
 * What a component is doing, for the `state()` keys: each state that holds is `true`; a state that is
 * not given does not hold. The names are the platform's (`Pressable` reports `{ pressed }`).
 */
export type InteractionState = { readonly [N in StateName]?: boolean }

/**
 * Whether the condition key `key` holds: a `when()` or `whenScheme()` key when the nearest theme or color
 * scheme of `current` is the one it names, a `state()` key when its state is `true` in `interaction`.
 */
export function matchesCondition(
  key: string,
  current: NativeCondition | undefined,
  interaction?: InteractionState
): boolean {
  const stateName = readState(key)
  if (stateName !== undefined) return interaction?.[stateName] === true
  const condition = readCondition(key)
  if (condition === undefined || current === undefined) return false
  if (condition.kind === 'theme') return themesById.get(condition.id) === current.theme
  return (current.colorScheme ?? platformAppearance.getColorScheme()) === condition.scheme
}
