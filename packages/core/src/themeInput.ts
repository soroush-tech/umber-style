import { mergeDeep } from './mergeDeep'
import type { DeepPartial } from './tokens'

/** What a provider is given: the theme, or the part of it that its subtree changes; or a function of the theme above it that returns that. */
export type ThemeInput<T> = DeepPartial<T> | ((outer: T) => DeepPartial<T>)

/** The theme where there is no provider and no base theme: an object with nothing in it, never changed. */
export const EMPTY_THEME: object = Object.freeze({})

/** The theme that a provider given `input` adds below `outer` (the theme above it, or `EMPTY_THEME`): the result of a function, or the object as it is. */
export function resolveThemeInput<T>(input: ThemeInput<T>, outer: T): DeepPartial<T> {
  return typeof input === 'function' ? (input as (outer: T) => DeepPartial<T>)(outer) : input
}

/** The theme below a provider: `given` merged over the theme above it, or `given` as it is where there is none above and no base theme. */
export function mergeTheme<T>(outer: T | undefined, given: DeepPartial<T>): T {
  return outer === undefined ? (given as T) : mergeDeep(outer, given)
}
