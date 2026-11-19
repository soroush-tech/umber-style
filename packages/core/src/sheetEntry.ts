import type { StyleObject } from './serialize'
import type { WebStyleObject } from './webStyle'

const BRAND = Symbol.for('umber-style.sheet-entry')
const ENTRY_KEY_PREFIX = '--umber-entry-'

/** One style of a sheet: it carries the class name that the cache made for it, and nothing else. */
export interface SheetEntry {
  readonly className: string
}

/**
 * Makes the entry of a class name: a frozen object that `isSheetEntry` knows and that prints as the
 * class name. Its one enumerable key is a custom property named after the class, with the value `null`,
 * so that a framework that merges the style objects of an array (Vue does) keeps every entry, and
 * `flattenStyle` finds them by the key. Both frameworks skip a `null` style value on a plain element, on
 * the client and on the server, so an entry given to a plain element renders no style attribute.
 */
export function createSheetEntry(className: string): SheetEntry {
  const entry = { [`${ENTRY_KEY_PREFIX}${className}`]: null, [BRAND]: true }
  Object.defineProperties(entry, {
    className: { value: className },
    toString: { value: () => className },
  })
  return Object.freeze(entry) as unknown as SheetEntry
}

/** Whether `value` was made by `createSheetEntry`: a class name is a plain string, a style object has no brand. */
export function isSheetEntry(value: unknown): value is SheetEntry {
  return typeof value === 'object' && value !== null && BRAND in value
}

/**
 * What a `style` prop holds, as a flat list in order, for the cache to merge into one class: sheet
 * entries and plain style objects, with arrays flattened and what is empty dropped. An object in which a
 * framework merged entries and plain keys (Vue does) is split back into its entries, then the rest. A
 * string is an error: a text style cannot be merged into a class.
 */
export function flattenStyle(style: unknown): (SheetEntry | WebStyleObject)[] {
  const flat: (SheetEntry | WebStyleObject)[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
    } else if (typeof value === 'string' && value) {
      throw new Error(
        'A style given as a string cannot be merged into a class: use a sheet entry or an object.'
      )
    } else if (typeof value === 'object' && value !== null) {
      const rest: StyleObject = {}
      for (const [key, item] of Object.entries(value)) {
        if (key.startsWith(ENTRY_KEY_PREFIX))
          flat.push(createSheetEntry(key.slice(ENTRY_KEY_PREFIX.length)))
        else rest[key] = item
      }
      if (Object.keys(rest).length > 0) flat.push(rest as WebStyleObject)
    }
  }
  visit(style)
  return flat
}
