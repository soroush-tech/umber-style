/** How many themes of distinct contents a memo keeps, the one used last first. */
export const RECENT_THEMES = 4

/** Whether `value` is an array, or an object made by a literal: what a theme is made of and walked into. */
function isContainer(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null || Array.isArray(value)
}

/** The pairs of containers being compared, from the outermost in: the first of each pair, and the second. */
interface ComparedPairs {
  firsts: object[]
  seconds: object[]
}

/** Whether the pair `first`, `second` is being compared further up: a cycle. */
function isComparing(pairs: ComparedPairs, first: object, second: object): boolean {
  for (let index = 0; index < pairs.firsts.length; index++) {
    if (pairs.firsts[index] === first && pairs.seconds[index] === second) return true
  }
  return false
}

/** Whether the members `key` of `first` and `second` hold the same: both enumerable or neither, and equal values or the same accessors. */
function isSameMember(
  first: object,
  second: object,
  key: PropertyKey,
  pairs: ComparedPairs
): boolean {
  // Both have the key: their keys were compared before.
  const own = Object.getOwnPropertyDescriptor(first, key) as PropertyDescriptor
  const other = Object.getOwnPropertyDescriptor(second, key) as PropertyDescriptor
  if (own.enumerable !== other.enumerable) return false
  if ('value' in own) return 'value' in other && compareThemes(own.value, other.value, pairs)
  return !('value' in other) && own.get === other.get && own.set === other.set
}

/** `isSameTheme`, with the pairs of containers that are being compared further up. */
function compareThemes(first: unknown, second: unknown, pairs: ComparedPairs): boolean {
  if (first === second) return true
  if (!isContainer(first) || !isContainer(second)) return false
  if (Object.getPrototypeOf(first) !== Object.getPrototypeOf(second)) return false
  const keys = Reflect.ownKeys(first)
  const others = Reflect.ownKeys(second)
  if (keys.length !== others.length) return false
  for (let index = 0; index < keys.length; index++) {
    if (keys[index] !== others[index]) return false
  }
  // A pair met again is a cycle: it is taken as the same here, and the members of the pair decide.
  if (isComparing(pairs, first, second)) return true
  pairs.firsts.push(first)
  pairs.seconds.push(second)
  const isSame = keys.every((key) => isSameMember(first, second, key, pairs))
  pairs.firsts.pop()
  pairs.seconds.pop()
  return isSame
}

/**
 * Whether two themes have the same contents: the same value, or arrays and plain objects with the same
 * prototype and the same own keys (strings and symbols, enumerable or not) in the same order, each
 * member enumerable on both or on neither, and each the same value (compared the same way) or the same
 * accessors. Anything else, a function or a class instance under a raw key included, is the same only
 * when it is the same object. A theme that refers to itself is compared once around the cycle.
 */
export function isSameTheme(first: unknown, second: unknown): boolean {
  return compareThemes(first, second, { firsts: [], seconds: [] })
}

/**
 * Makes the function that gives, for a theme object, the first object seen with the same contents
 * (`isSameTheme`), or the object itself when none of the last `RECENT_THEMES` themes of distinct contents
 * has them. An object is compared once: what it was found to be is kept for it, weakly.
 */
export function createThemeMemo(): <T extends object>(theme: T) => T {
  const known = new WeakMap<object, object>()
  // The themes of distinct contents, the one used last first.
  let recent: object[] = []
  return <T extends object>(theme: T): T => {
    const found = known.get(theme)
    if (found !== undefined) return found as T
    const same = recent.find((earlier) => isSameTheme(earlier, theme)) ?? theme
    known.set(theme, same)
    recent = [same, ...recent.filter((earlier) => earlier !== same)].slice(0, RECENT_THEMES)
    return same as T
  }
}
