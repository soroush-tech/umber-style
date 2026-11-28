import type { Cache } from './cache'
import { isDevelopment } from './devChecks'
import type { StyleObject } from './serialize'
import {
  createThemedEntryError,
  findThemedEntry,
  isThemedEntry,
  readThemedSource,
  THEMED_KEY_PREFIX,
  type ThemedSource,
} from './themedEntry'
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
  /** The CSS text of the style: its declarations, then its nested rules with `&` for the class. Nothing is written. */
  readStyles(): string
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
  let styles: string | undefined
  Object.defineProperties(entry, {
    className: { get: read },
    toString: { value: read },
    ...(source
      ? {
          [SOURCE]: { value: source },
          name: { value: className },
          styles: { get: () => (styles ??= source.readStyles()) },
        }
      : {}),
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
 * name (one that no cache made), whose style is not known, and for a handle of a sheet made from a
 * function of the theme, which has no theme there.
 */
export function readEntryStyle(value: unknown, caller: string): unknown {
  if (isThemedEntry(value)) throw createThemedEntryError(`${caller}()`)
  if (!isSheetEntry(value)) return value
  const source = readEntrySource(value)
  if (!source) {
    throw new TypeError(
      `${caller}(): the sheet entry "${value.className}" is only a class name, so its style cannot be merged.`
    )
  }
  return source.style
}

/** The entry that the handle of `source` stands for in the component that renders now; the `TypeError` of `css()` where there is no component (`cache` is not given). */
function readHandle(source: ThemedSource | undefined, cache: Cache | undefined): SheetEntry {
  if (cache === undefined) throw createThemedEntryError('css()')
  return (source as ThemedSource).read() as SheetEntry
}

// The keys of the leftovers of a style passed from a server component that were warned about.
const warnedLeftovers = new Set<string>()

/**
 * Warns once for each key, in development, that a styled component (of a binding that does not merge
 * style objects) was given `key` alone in an object with no brand: what an entry or a handle becomes when
 * a server component passes it to a client component, whose CSS does not cross.
 */
function warnLeftover(prefix: string, key: string): void {
  if (warnedLeftovers.has(key) || !isDevelopment()) return
  warnedLeftovers.add(key)
  console.warn(
    `[${prefix}] A style was passed from a server component to a client component (${key}), and its CSS cannot cross: import the sheet in the client component, and pass a plain value such as a string to choose the style.`
  )
}

/**
 * What a `style` prop holds, as a flat list in order, for the cache to merge into one class: sheet
 * entries and plain style objects, with arrays flattened and what is empty dropped. An object in which a
 * framework merged entries and plain keys (Vue does) is split back into its entries, then the rest; an
 * entry is looked up by its class name with `findEntry` (a cache's `findEntry`), else it is only the name.
 * A string is an error: a text style cannot be merged into a class.
 *
 * `cache` is given for the `style` prop of a styled component, which has a theme: a handle of a sheet
 * made from a function of the theme is then its entry for the component that renders now (a handle that
 * a framework merged into an object is found by its key where `findEntry` is given, as Vue merges).
 * Without it (`css()`) a handle is a `TypeError`. With `cache` and no `findEntry` (React), an object
 * with no brand whose one key is that of an entry or of a handle is what a server component passing it to
 * a client component left of it, with no CSS: a development warning says so; the entry is its class name
 * as before, and the handle is nothing.
 */
export function flattenStyle(
  style: unknown,
  findEntry?: (className: string) => SheetEntry | undefined,
  cache?: Cache
): (SheetEntry | WebStyleObject)[] {
  const flat: (SheetEntry | WebStyleObject)[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
    } else if (typeof value === 'string' && value) {
      throw new Error(
        'A style given as a string cannot be merged into a class: use a sheet entry or an object.'
      )
    } else if (isThemedEntry(value)) {
      flat.push(readHandle(readThemedSource(value), cache))
    } else if (isSheetEntry(value) && readEntrySource(value)) {
      // A spread copies the brand but not the source, so what has a source is a whole entry.
      flat.push(value)
    } else if (typeof value === 'object' && value !== null) {
      const rest: StyleObject = {}
      const pairs = Object.entries(value)
      const isLeftover = cache !== undefined && findEntry === undefined && pairs.length === 1
      for (const [key, item] of pairs) {
        if (key.startsWith(ENTRY_KEY_PREFIX)) {
          const name = key.slice(ENTRY_KEY_PREFIX.length)
          if (isLeftover && !isSheetEntry(value)) warnLeftover((cache as Cache).prefix, key)
          flat.push(findEntry?.(name) ?? createSheetEntry(name))
        } else if (key.startsWith(THEMED_KEY_PREFIX)) {
          // Only a framework that merges style objects keeps the key of a handle of its own.
          if (findEntry === undefined) {
            if (isLeftover) warnLeftover((cache as Cache).prefix, key)
            continue
          }
          const handle = findThemedEntry(key.slice(THEMED_KEY_PREFIX.length))
          flat.push(readHandle(readThemedSource(handle), cache))
        } else rest[key] = item
      }
      if (Object.keys(rest).length > 0) flat.push(rest as WebStyleObject)
    }
  }
  visit(style)
  return flat
}
