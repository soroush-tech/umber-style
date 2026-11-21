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

/** `value` as plain data, the same value when it already is; `DROPPED` for a value that cannot cross. */
function toPlain(value: unknown, path: string, dropped: string[]): unknown {
  if (typeof value === 'function' || typeof value === 'symbol') {
    dropped.push(path)
    return DROPPED
  }
  if (typeof value !== 'object' || value === null) return value
  const at = (key: string | number) => (path === '' ? String(key) : `${path}.${key}`)
  if (Array.isArray(value)) {
    const items = value.map((item: unknown, index) => toPlain(item, at(index), dropped))
    // A member left out of a list stays a place in it, with nothing in it.
    const plain = items.map((item) => (item === DROPPED ? undefined : item))
    return plain.every((item, index) => item === value[index]) ? value : plain
  }
  if (!isPlainObject(value)) {
    dropped.push(path)
    return DROPPED
  }
  const entries = Object.entries(value).map(
    ([key, member]) => [key, toPlain(member, at(key), dropped)] as const
  )
  const kept = entries.filter(([, member]) => member !== DROPPED)
  const isSame =
    Object.getPrototypeOf(value) === Object.prototype &&
    kept.length === entries.length &&
    kept.every(([key, member]) => member === (value as Record<string, unknown>)[key])
  // An object with no prototype is copied: only an object with the usual one crosses.
  return isSame ? value : Object.fromEntries(kept)
}

const plainThemes = new WeakMap<object, PlainTheme>()

/**
 * The plain data of `theme`: strings, numbers, booleans, `null`, `undefined`, lists and plain objects,
 * deeply. A function, a symbol and an object that is not plain (a class instance, a `Date`, a `Map`) are
 * left out, and their paths listed. Only own enumerable members are read. Made once for each theme
 * object, so a payload that names one theme in several places holds it once.
 */
export function toPlainTheme(theme: object): PlainTheme {
  let found = plainThemes.get(theme)
  if (found === undefined) {
    const dropped: string[] = []
    const plain = toPlain(theme, '', dropped)
    found = { theme: plain === DROPPED ? {} : (plain as object), dropped }
    plainThemes.set(theme, found)
  }
  return found
}
