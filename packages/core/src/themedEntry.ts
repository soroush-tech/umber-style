import { readSharedState } from './sharedState'

const THEMED = Symbol.for('umber-style.themed-entry')

/** The start of the one enumerable key of a handle, with the id of the handle after it. */
export const THEMED_KEY_PREFIX = '--umber-themed-'

/** The handles by id, shared by every copy of the core: a framework that merges style objects (Vue) keeps only the key of a handle. */
const handles = readSharedState('core.themed-entries@1', () => ({
  byId: new Map<string, ThemedEntry>(),
  count: 0,
}))

declare const themedBrand: unique symbol

/**
 * An entry of a sheet made from a function of the theme, read before the sheet is resolved
 * (`sheet.card`): the sheet and the name, nothing computed. A styled component resolves it with the theme
 * it renders under; anywhere else it is a `TypeError`.
 */
export interface ThemedEntry {
  readonly [themedBrand]: true
}

/**
 * The names of a sheet that are not handles: those `createThemedSheet` lets through (the members of
 * every object, `then`, `toJSON`, `$$typeof`, a name that starts with `__`) and `Own`, the sheet's own
 * members.
 */
type PassedName<Own extends string> =
  | Own
  | 'constructor'
  | 'toString'
  | 'toLocaleString'
  | 'valueOf'
  | 'hasOwnProperty'
  | 'isPrototypeOf'
  | 'propertyIsEnumerable'
  | 'then'
  | 'toJSON'
  | '$$typeof'
  | `__${string}`

/** The handles of a sheet made from a function of the theme, one for each of its names `K`; `Own` are the members the sheet has itself. */
export type ThemedEntries<K extends string, Own extends string = 'resolve'> = {
  readonly [P in Exclude<K, PassedName<Own>>]: ThemedEntry
}

/** What a handle stands for: the sheet, the name of the style in it, and how the binding reads its entry. */
export interface ThemedSource {
  /** The sheet the handle was read from, as the binding made it. */
  readonly sheet: object
  /** The name of the style in the sheet. */
  readonly key: string
  /** The entry for the component that renders now: the binding's `useStyle(sheet)[key]`. */
  readonly read: () => unknown
}

/** How a binding makes the handles of a sheet made from a function of the theme. */
export interface ThemedSheetOptions {
  /** The entry of `key` for the component that renders now: the binding's `useStyle(sheet)[key]`. None where the binding resolves the source itself (React Native). */
  readEntry?(key: string): unknown
  /**
   * Whether the enumerable key of a handle holds `null`: for a framework that merges the style objects of
   * a list into one (Vue), and for the server components build, whose props React serializes for a client
   * component and reads every key of for its messages of development. Without it, reading that key is the
   * `TypeError` of a plain element.
   */
  isMerged?: boolean
}

/** Whether `value` is a handle of `createThemedSheet`. */
export function isThemedEntry(value: unknown): value is ThemedEntry {
  return typeof value === 'object' && value !== null && THEMED in value
}

/** What the handle `value` stands for, or undefined when it is not a handle. */
export function readThemedSource(value: unknown): ThemedSource | undefined {
  return isThemedEntry(value)
    ? (value as unknown as Record<symbol, ThemedSource>)[THEMED]
    : undefined
}

/** The handle that a framework merged into an object, by the id in its key. */
export function findThemedEntry(id: string): ThemedEntry | undefined {
  return handles.byId.get(id)
}

/**
 * The error of a handle given where no theme is known: `where` names the place, the message says what
 * resolves it instead.
 */
export function createThemedEntryError(where: string): TypeError {
  return new TypeError(
    `${where}: an entry of a sheet made from a function of the theme (StyleSheet.create((theme) => ...)) has no theme here. Give it to the style prop of a styled component, which resolves it with its theme, or read the entry from useStyle(sheet) first.`
  )
}

/** Throws the error of `createThemedEntryError(where)` when a value of `values`, or of a list among them, is a handle. */
export function rejectThemedEntries(values: readonly unknown[], where: string): void {
  for (const value of values) {
    if (Array.isArray(value)) rejectThemedEntries(value, where)
    else if (isThemedEntry(value)) throw createThemedEntryError(where)
  }
}

/** The handle of `key` of a sheet: frozen, one enumerable key, the source under a symbol. */
function createHandle(sheet: object, key: string, id: string, options: ThemedSheetOptions) {
  const { readEntry, isMerged = false } = options
  const read = () => {
    const entry = readEntry?.(key)
    if (entry === undefined) throw new TypeError(`The sheet has no style named "${key}".`)
    return entry
  }
  const source: ThemedSource = { sheet, key, read }
  const handle = {}
  Object.defineProperties(handle, {
    // Read by a framework that merges style objects (Vue); a plain element of React reads it too.
    [`${THEMED_KEY_PREFIX}${id}`]: isMerged
      ? { value: null, enumerable: true }
      : {
          get: () => {
            throw createThemedEntryError('A plain element')
          },
          enumerable: true,
        },
    [THEMED]: { value: source },
    toString: {
      value: () => {
        throw createThemedEntryError('Its text (a class name)')
      },
    },
  })
  return Object.freeze(handle) as ThemedEntry
}

/** The names that frameworks and serializers read on any object: never the name of a style. */
const PASSED_NAMES = new Set(['then', 'toJSON', '$$typeof'])

/** Whether reading `key` of a sheet gives what the sheet has, not a handle. */
function isPassed(target: object, key: string | symbol): boolean {
  return typeof key === 'symbol' || key in target || PASSED_NAMES.has(key) || key.startsWith('__')
}

/**
 * `sheet` with a handle for each name it does not have itself, made on first read and kept. What passes
 * through is what the sheet was to the binding and to the frameworks that look at it: a symbol, an own
 * member (`resolve`, `prepare`), a member of every object, `then` (it is not a promise), `toJSON`,
 * `$$typeof` and a name that starts with `__` (the marks a framework reads).
 */
export function createThemedSheet<S extends object>(sheet: S, options: ThemedSheetOptions): S {
  const sheetId = String(++handles.count)
  const made = new Map<string, ThemedEntry>()
  return new Proxy(sheet, {
    get(target, key, receiver) {
      if (isPassed(target, key)) return Reflect.get(target, key, receiver)
      const name = key as string
      let handle = made.get(name)
      if (handle === undefined) {
        const id = `${sheetId}.${name}`
        handle = createHandle(receiver as object, name, id, options)
        made.set(name, handle)
        handles.byId.set(id, handle)
      }
      return handle
    },
  })
}
