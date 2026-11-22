/** Whether `value` is an array, or an object made by a literal. */
function isContainer(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null || Array.isArray(value)
}

/** The pairs whose members are being compared, by the first of each pair. */
type PendingPairs = Map<object, Set<object>>

/** Whether two descriptors hold the same: equal values, or the same accessors. */
function isSameDescriptor(
  first: PropertyDescriptor,
  second: PropertyDescriptor,
  pending: PendingPairs
): boolean {
  if ('value' in first) {
    return 'value' in second && compareViews(first.value, second.value, pending)
  }
  return first.get === second.get && first.set === second.set
}

/** `isSameView`, with the pairs of containers that are being compared further up. */
function compareViews(first: unknown, second: unknown, pending: PendingPairs): boolean {
  if (first === second) return true
  if (!isContainer(first) || !isContainer(second)) return false
  if (Object.getPrototypeOf(first) !== Object.getPrototypeOf(second)) return false
  const keys = Reflect.ownKeys(first)
  if (keys.length !== Reflect.ownKeys(second).length) return false
  // A pair met again is a cycle: it is taken as the same here, and the members of the pair decide.
  const seconds = pending.get(first)
  if (seconds?.has(second)) return true
  if (seconds) seconds.add(second)
  else pending.set(first, new Set([second]))
  return keys.every((key) => {
    const other = Object.getOwnPropertyDescriptor(second, key)
    const own = Object.getOwnPropertyDescriptor(first, key) as PropertyDescriptor
    return other !== undefined && isSameDescriptor(own, other, pending)
  })
}

/**
 * Whether two theme views hold the same thing: arrays and plain objects with the same own members
 * (enumerable or not), each the same, and anything else the same value (a function, a class instance,
 * by identity). Two views of themes that differ only in the values of their variables are the same. A
 * view that refers to itself is compared once around the cycle.
 */
export function isSameView(first: unknown, second: unknown): boolean {
  return compareViews(first, second, new Map())
}
