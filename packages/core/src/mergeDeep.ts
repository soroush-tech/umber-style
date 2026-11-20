import type { DeepPartial } from './tokens'

/** Whether `value` is an object made by a literal, not a class instance. */
function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * `override` over `base`: plain objects merge key by key, everything else is replaced, undefined keeps
 * `base`. Every own member is taken with its descriptor, so a member that is not enumerable (a helper
 * function on `breakpoints`) is kept, from `override` when it has one, else from `base`.
 */
export function mergeDeep<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (override === undefined) return base
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(base)
  const given = Object.getOwnPropertyDescriptors(override)
  for (const key of Reflect.ownKeys(given)) {
    const descriptor = given[key as string] as PropertyDescriptor
    descriptors[key] =
      'value' in descriptor
        ? { ...descriptor, value: mergeDeep(base[key], descriptor.value) }
        : descriptor
  }
  return Object.create(Object.getPrototypeOf(base), descriptors) as T
}
