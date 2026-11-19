import type { DeepPartial } from './tokens'

/** Whether `value` is an object made by a literal, not a class instance. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** `override` over `base`: plain objects merge key by key, everything else is replaced, undefined keeps `base`. */
export function mergeDeep<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (override === undefined) return base
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    merged[key] = mergeDeep(base[key], value)
  }
  return merged as T
}
