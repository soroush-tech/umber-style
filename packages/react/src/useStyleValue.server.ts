import {
  createLiveValue,
  isDevelopment,
  writeLiveValue,
  type Cache,
  type LiveValue,
} from '@umber-style/core'
import type { StyleValueSetter } from './types'

/**
 * Makes `useStyleValue` for server components, which have no hook and never run in the browser: the
 * value is a reference to a variable that nothing declares, so its fallback, the first number, is what
 * a style reads, and the setter changes only what `get()` returns, with one warning in development.
 * The same source written for a client component works in either build.
 */
export function createServerStyleValue(cache: Cache) {
  let hasWarned = false
  const set =
    (value: LiveValue): StyleValueSetter =>
    (next) => {
      if (!hasWarned && isDevelopment()) {
        hasWarned = true
        console.warn(
          `[${cache.prefix}] The setter of useStyleValue() was called in a server component, which does not run in the browser: the page keeps the first value. Call useStyleValue() in a client component to change it.`
        )
      }
      writeLiveValue(value, typeof next === 'function' ? next(value.get()) : next)
    }
  return function useStyleValue(initial: number, unit?: string): [LiveValue, StyleValueSetter] {
    const value = createLiveValue(`--${cache.prefix}-value-server`, initial, unit)
    return [value, set(value)]
  }
}
