import type { Cache } from './cache'
import type { StyleObject } from './serialize'
import type { WebStyleObject } from './webStyle'

const BRAND = Symbol.for('umber-style.sheet-entry')
const SOURCE = Symbol.for('umber-style.sheet-entry-source')
const ENTRY_KEY_PREFIX = '--umber-entry-'

/** The two ways an entry is used: on its own (a plain element, `apply`), or given to a styled component through `style`. */
export type EntryRole = 'components' | 'overrides'

/** What a cache gives an entry that it made: the style, and the class of each role, written on first use. */
export interface EntrySource {
  /** The style of the entry, merged. */
  readonly style: StyleObject
  /** The cache that made the entry, whose rules `use` writes. */
  readonly cache: Cache
  /** The class name for `role`; its rule is written, once, the first time it is asked for. */
  use(role: EntryRole): string
}

/** One style of a sheet: it carries the class name that the cache made for it, and nothing else. */
export interface SheetEntry {
  /** The class name of the entry used on its own. Reading it writes its rule, if that was not written yet. */
  readonly className: string
}

/**
 * Makes the entry of a class name: a frozen object that `isSheetEntry` knows and that prints as the
 * class name. Its one enumerable key is a custom property named after the class, with the value `null`,
 * so that a framework that merges the style objects of an array (Vue does) keeps every entry, and
 * `flattenStyle` finds them by the key. Both frameworks skip a `null` style value on a plain element, on
 * the client and on the server, so an entry given to a plain element renders no style attribute. With a
 * `source` (a cache made it) the class name is read through it, so that the rule is written when the entry
 * is used, not when it is made; without one the entry is just the name.
 */
export function createSheetEntry(className: string, source?: EntrySource): SheetEntry {
  const entry = { [`${ENTRY_KEY_PREFIX}${className}`]: null, [BRAND]: true }
  const read = () => source?.use('components') ?? className
  Object.defineProperties(entry, {
    className: { get: read },
    toString: { value: read },
    ...(source ? { [SOURCE]: { value: source } } : {}),
  })
  return Object.freeze(entry) as unknown as SheetEntry
}

/** Whether `value` was made by `createSheetEntry`: a class name is a plain string, a style object has no brand. */
export function isSheetEntry(value: unknown): value is SheetEntry {
  return typeof value === 'object' && value !== null && BRAND in value
}

/** What a cache gave `entry` to make its classes, or undefined for an entry that is only a name. */
export function readEntrySource(entry: SheetEntry): EntrySource | undefined {
  return (entry as unknown as Record<symbol, EntrySource | undefined>)[SOURCE]
}

/** The cache that made the first entry among `values` that a cache made, or undefined when there is none. */
export function findEntryCache(values: readonly unknown[]): Cache | undefined {
  for (const value of values) {
    const source = isSheetEntry(value) ? readEntrySource(value) : undefined
    if (source) return source.cache
  }
  return undefined
}

/**
 * The style of `value` when it is a sheet entry, else `value` as it is: for a place that takes a style
 * object and so also an entry. Throws a `TypeError`, that names `caller`, for an entry that is only a class
 * name (one that no cache made), whose style is not known.
 */
export function readEntryStyle(value: unknown, caller: string): unknown {
  if (!isSheetEntry(value)) return value
  const source = readEntrySource(value)
  if (!source) {
    throw new TypeError(
      `${caller}(): the sheet entry "${value.className}" is only a class name, so its style cannot be merged.`
    )
  }
  return source.style
}

/**
 * What a `style` prop holds, as a flat list in order, for the cache to merge into one class: sheet
 * entries and plain style objects, with arrays flattened and what is empty dropped. An object in which a
 * framework merged entries and plain keys (Vue does) is split back into its entries, then the rest; an
 * entry is looked up by its class name with `findEntry` (a cache's `findEntry`), else it is only the name.
 * A string is an error: a text style cannot be merged into a class.
 */
export function flattenStyle(
  style: unknown,
  findEntry?: (className: string) => SheetEntry | undefined
): (SheetEntry | WebStyleObject)[] {
  const flat: (SheetEntry | WebStyleObject)[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
    } else if (typeof value === 'string' && value) {
      throw new Error(
        'A style given as a string cannot be merged into a class: use a sheet entry or an object.'
      )
    } else if (isSheetEntry(value) && readEntrySource(value)) {
      // A spread copies the brand but not the source, so what has a source is a whole entry.
      flat.push(value)
    } else if (typeof value === 'object' && value !== null) {
      const rest: StyleObject = {}
      for (const [key, item] of Object.entries(value)) {
        if (key.startsWith(ENTRY_KEY_PREFIX)) {
          const name = key.slice(ENTRY_KEY_PREFIX.length)
          flat.push(findEntry?.(name) ?? createSheetEntry(name))
        } else rest[key] = item
      }
      if (Object.keys(rest).length > 0) flat.push(rest as WebStyleObject)
    }
  }
  visit(style)
  return flat
}
