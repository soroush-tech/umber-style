/** The part of a theme that crosses from a server component to a client component, and what was left out. */
export interface PlainTheme {
  /** The theme with only plain data: `theme` itself when all of it is. */
  readonly theme: object
  /** The dotted paths of the members left out: a function, a symbol, an object that is not plain (a class instance). */
  readonly dropped: readonly string[]
}

/** What `toPlain` returns for a value that cannot cross. */
const DROPPED: unique symbol = Symbol('dropped')

/** Whether `value` is an object made by a literal, or with no prototype. */
function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * `value` as plain data, the same value when it already is; `DROPPED` for a value that cannot cross.
 * `ancestors` holds the objects that `value` is inside of: one of them met again is a cycle, left out.
 */
function toPlain(value: unknown, path: string, dropped: string[], ancestors: Set<object>): unknown {
  if (typeof value === 'function' || typeof value === 'symbol') {
    dropped.push(path)
    return DROPPED
  }
  if (typeof value !== 'object' || value === null) return value
  if (ancestors.has(value)) {
    dropped.push(path)
    return DROPPED
  }
  ancestors.add(value)
  const plain = toPlainContainer(value, path, dropped, ancestors)
  ancestors.delete(value)
  return plain
}

/** `toPlain` of an object: an array, a plain object, or another object, which cannot cross. */
function toPlainContainer(
  value: object,
  path: string,
  dropped: string[],
  ancestors: Set<object>
): unknown {
  const joinPath = (key: string | number) => (path === '' ? String(key) : `${path}.${key}`)
  if (Array.isArray(value)) {
    const items = value.map((item: unknown, index) =>
      toPlain(item, joinPath(index), dropped, ancestors)
    )
    // A member left out of a list stays a place in it, with nothing in it.
    const plain = items.map((item) => (item === DROPPED ? undefined : item))
    return plain.every((item, index) => item === value[index]) ? value : plain
  }
  if (!isPlainObject(value)) {
    dropped.push(path)
    return DROPPED
  }
  const entries = Object.entries(value).map(
    ([key, member]) => [key, toPlain(member, joinPath(key), dropped, ancestors)] as const
  )
  const kept = entries.filter(([, member]) => member !== DROPPED)
  // A member that is not enumerable or has a symbol for its key (a helper that a design system puts on
  // `breakpoints` with `Object.defineProperty`) is not read, and not reported: such an object is copied
  // with its enumerable members, as only an object with none of them crosses as it is.
  const isSame =
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === entries.length &&
    kept.length === entries.length &&
    kept.every(([key, member]) => member === (value as Record<string, unknown>)[key])
  // An object with no prototype is copied: only an object with the usual one crosses.
  return isSame ? value : Object.fromEntries(kept)
}

const plainThemes = new WeakMap<object, PlainTheme>()

/**
 * The plain data of `theme`: strings, numbers, booleans, `null`, `undefined`, lists and plain objects,
 * deeply. A function, a symbol and an object that is not plain (a class instance, a `Date`, a `Map`) are
 * left out, and their paths listed, and so is a member that refers back to an object it is inside of (a
 * cycle). Only own enumerable members are read: a plain object that has others (not enumerable, or under a
 * symbol) is copied without them, which is not reported. Made once for each theme
 * object, so a payload that names one theme in several places holds it once.
 */
export function toPlainTheme(theme: object): PlainTheme {
  let found = plainThemes.get(theme)
  if (found === undefined) {
    const dropped: string[] = []
    const plain = toPlain(theme, '', dropped, new Set())
    found = { theme: plain === DROPPED ? {} : (plain as object), dropped }
    plainThemes.set(theme, found)
  }
  return found
}
