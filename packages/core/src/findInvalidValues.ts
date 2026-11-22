import { isAlphaColor } from './alpha'
import type { StyleObject } from './serialize'

/** A declared value that no CSS property takes, found by the engine on its own: the key it is under, and what it is. */
export interface InvalidValue {
  /** The key of the style it is under, as written (`width`, `backgroundColor`). */
  readonly key: string
  /** What the value is, for a message: `true`, `a function`, `NaN`, `an object in a list of values`. */
  readonly kind: string
}

/** What `value` is when it is of a kind that is never a CSS value, whatever the property; undefined for any other value. */
function describeKind(value: unknown): string | undefined {
  if (value === true) return 'true'
  if (typeof value === 'function') return 'a function'
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
  return undefined
}

/** What an item of a list of values is when it is never a CSS value: a kind above, or an object that is not an `alpha()` result. */
function describeItem(item: unknown): string | undefined {
  if (typeof item === 'object' && item !== null && !isAlphaColor(item)) {
    return 'an object in a list of values'
  }
  return describeKind(item)
}

/** Adds to `found` the invalid values of `style`, at any depth of its nested rules. */
function addInvalidValues(style: StyleObject, found: InvalidValue[]): void {
  for (const [key, value] of Object.entries(style)) {
    // The native part of a shared style is not written on the web, and holds what React Native takes.
    if (key === 'label' || key === 'native') continue
    if (value === null || value === undefined || value === false) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        const kind = describeItem(item)
        if (kind !== undefined) found.push({ key, kind })
      }
    } else if (typeof value === 'object' && !isAlphaColor(value)) {
      addInvalidValues(value as StyleObject, found)
    } else {
      const kind = describeKind(value)
      if (kind !== undefined) found.push({ key, kind })
    }
  }
}

/**
 * The declared values of `style` (nested rules too) that the engine can tell are never valid CSS, for any
 * property: `true`, a function, a number that is not finite (`NaN`, `Infinity`), and an object in a list of
 * values. A word such as `light` is not one of them: whether a property takes a word is the browser's to say
 * (`findUnsupportedDeclarations`). An object under a key is a nested rule, and is not one of them either.
 */
export function findInvalidValues(style: StyleObject): InvalidValue[] {
  const found: InvalidValue[] = []
  addInvalidValues(style, found)
  return found
}
