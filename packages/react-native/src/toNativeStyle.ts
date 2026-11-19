import type { NativeStyleObject } from './nativeStyle'
import { warnAboutValues } from './warnStyle'

/** Whether `value` is a plain object: the `native` part of a style. */
function isNested(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether the key `name` exists only on the web: a selector, an at-rule, a custom property or `label`. */
function isWebOnlyKey(name: string): boolean {
  return name === 'label' || name.includes('&') || /^(?::|@|--)/.test(name)
}

/**
 * `style` without the web-only keys: `label`, selectors (a key with `&` or one that starts with `:`),
 * at-rules and custom properties, each dropped whole. Objects and arrays under any other key are kept
 * (`shadowOffset`, `transform`). A style written for both platforms has a `native` part, which is merged
 * over the rest, and a `web` part, which is dropped.
 */
export function toNativeStyle(style: Record<string, unknown>): NativeStyleObject {
  const { web: _web, native, ...rest } = style
  const merged = isNested(native) ? { ...rest, ...(native as Record<string, unknown>) } : rest
  const resolved = Object.fromEntries(Object.entries(merged).filter(([key]) => !isWebOnlyKey(key)))
  warnAboutValues(resolved)
  return resolved as NativeStyleObject
}
