/** Whether `value` is an array, or an object made by a literal. */
function isContainer(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null || Array.isArray(value)
}

/** Whether two descriptors hold the same: equal values, or the same accessors. */
function isSameDescriptor(first: PropertyDescriptor, second: PropertyDescriptor): boolean {
  if ('value' in first) return 'value' in second && isSameView(first.value, second.value)
  return first.get === second.get && first.set === second.set
}

/**
 * Whether two theme views hold the same thing: arrays and plain objects with the same own members
 * (enumerable or not), each the same, and anything else the same value (a function, a class instance,
 * by identity). Two views of themes that differ only in the values of their variables are the same.
 */
export function isSameView(first: unknown, second: unknown): boolean {
  if (first === second) return true
  if (!isContainer(first) || !isContainer(second)) return false
  if (Object.getPrototypeOf(first) !== Object.getPrototypeOf(second)) return false
  const keys = Reflect.ownKeys(first)
  if (keys.length !== Reflect.ownKeys(second).length) return false
  return keys.every((key) => {
    const other = Object.getOwnPropertyDescriptor(second, key)
    const own = Object.getOwnPropertyDescriptor(first, key) as PropertyDescriptor
    return other !== undefined && isSameDescriptor(own, other)
  })
}
