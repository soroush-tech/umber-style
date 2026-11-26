import { mergeDeep } from './mergeDeep'
import type { ThemeGuard } from './referenceKeys'
import { isSameTheme, RECENT_THEMES } from './sameTheme'
import type { DeepPartial } from './tokens'

/** What a provider is given: the theme, or the part of it that its subtree changes; or a function of the theme above it that returns that. */
export type ThemeInput<T> = DeepPartial<T> | ((outer: T) => DeepPartial<T>)

/** The theme where there is no provider and no base theme: an object with nothing in it, never changed. */
export const EMPTY_THEME: object = Object.freeze({})

/**
 * The theme that a provider given `input` adds below `outer` (the theme above it, or `EMPTY_THEME`): the
 * result of a function, or the object as it is. A function gets `outer` through `guard` when one is given
 * (the development guard of the binding, under the label `ThemeProvider`), else as it is.
 */
export function resolveThemeInput<T>(
  input: ThemeInput<T>,
  outer: T,
  guard?: ThemeGuard
): DeepPartial<T> {
  if (typeof input !== 'function') return input
  const given = guard ? guard(outer as T & object, 'ThemeProvider') : outer
  return (input as (outer: T) => DeepPartial<T>)(given)
}

// The merge of each pair of objects, by the theme above and then the given: both kept weakly.
const pairs = new WeakMap<object, WeakMap<object, unknown>>()
// For each theme above, the last merges over it of givens of distinct contents: the given (newest first),
// and the theme it made.
const merges = new WeakMap<object, [unknown, unknown][]>()

/** The merge of `given` over `outer` found by contents among the last ones over `outer`, or made now and kept. */
function findMerge<T>(outer: T & object, given: DeepPartial<T>): T {
  const recent = merges.get(outer) ?? []
  const found = recent.find(([earlier]) => isSameTheme(earlier, given))
  if (found !== undefined) return found[1] as T
  const merged = mergeDeep(outer, given)
  merges.set(outer, [[given, merged] as [unknown, unknown], ...recent].slice(0, RECENT_THEMES))
  return merged
}

/**
 * The theme below a provider: `given` merged over the theme above it, or `given` as it is where there is
 * none above and no base theme. The same pair of objects gives the same theme every time, and a `given`
 * of the same contents as one of the last ones merged over the same `outer` (`isSameTheme`) gives the
 * theme that merge made, so that a provider given a new object in each render passes on one object.
 */
export function mergeTheme<T>(outer: T | undefined, given: DeepPartial<T>): T {
  if (outer === undefined) return given as T
  if (typeof outer !== 'object' || outer === null) return mergeDeep(outer, given)
  // A given that is no object (nothing, a value) is merged each time, which costs nothing.
  if (typeof given !== 'object' || given === null) return mergeDeep(outer, given)
  let byGiven = pairs.get(outer)
  if (byGiven === undefined) {
    byGiven = new WeakMap()
    pairs.set(outer, byGiven)
  }
  if (byGiven.has(given)) return byGiven.get(given) as T
  const merged = findMerge(outer, given)
  byGiven.set(given, merged)
  return merged
}
