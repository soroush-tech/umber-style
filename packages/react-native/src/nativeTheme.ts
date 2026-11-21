import { mergeDeep, type DeepPartial } from '@umber-style/core'
import { toLength } from './units'

/** The top-level theme keys whose values are lengths when no `lengthKeys` option is given: the default of the web. */
export const DEFAULT_LENGTH_KEYS = ['space', 'sizes', 'radii', 'fontSizes', 'borderWidths'] as const

/** One of the default length keys of a theme. */
export type DefaultLengthKey = (typeof DEFAULT_LENGTH_KEYS)[number]

/**
 * A theme value under a length key as React Native holds it: a string type that is a length (`'8px'`,
 * `'1rem'`, `'8'`) is `number`, a plain `string` may have become one (`string | number`), any other
 * string (`'50%'`, `'auto'`) and a function stay, and objects and arrays are mapped member by member.
 */
export type NativeLength<V> = V extends `${number}px` | `${number}rem` | `${number}`
  ? number
  : V extends string
    ? string extends V
      ? string | number
      : V
    : V extends (...args: never[]) => unknown
      ? V
      : V extends object
        ? { [K in keyof V]: NativeLength<V[K]> }
        : V

/**
 * The theme `T` as React Native holds it: the values under the default length keys (`space`, `sizes`,
 * `radii`, `fontSizes`, `borderWidths`) are numbers where they were lengths, the rest is `T` itself.
 */
export type NativeTheme<T> = {
  [K in keyof T]: K extends DefaultLengthKey ? NativeLength<T[K]> : T[K]
}

/** Whether `value` is an object made by a literal, not a class instance. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** `node` with each string that is a length (`px`, `rem` or no unit) a number; `node` itself when nothing changes. */
function convertLengths(node: unknown, remBase: number): unknown {
  if (typeof node === 'string') return toLength(node, remBase) ?? node
  const isArray = Array.isArray(node)
  if (!isArray && !isPlainObject(node)) return node
  const source = node as Record<string, unknown>
  let copy: Record<string, unknown> | undefined
  for (const key of Object.keys(source)) {
    const value = source[key]
    const converted = convertLengths(value, remBase)
    // A copy keeps the other members of an array as well (`space.small` next to the items).
    if (converted === value) continue
    copy ??= Object.assign(isArray ? [] : {}, source)
    copy[key] = converted
  }
  return copy ?? node
}

/**
 * `theme` as React Native holds it: under each of `lengthKeys` (top-level keys), every string that is a
 * length becomes a number, `rem` times `remBase`. Nothing else is touched (`breakpoints` and its helper
 * functions included), and a theme with nothing to convert is returned as it is.
 */
export function toNativeTheme<T extends object>(
  theme: T,
  lengthKeys: readonly string[],
  remBase: number
): NativeTheme<T> {
  const source = theme as Record<string, unknown>
  let changes: Record<string, unknown> | undefined
  for (const key of lengthKeys) {
    const converted = convertLengths(source[key], remBase)
    if (converted === source[key]) continue
    changes ??= {}
    changes[key] = converted
  }
  return (changes ? mergeDeep(theme, changes as DeepPartial<T>) : theme) as NativeTheme<T>
}
