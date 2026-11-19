import type { NativeStyleObject } from './nativeStyle'
import { warnAboutValues } from './warnStyle'

/** Whether `value` is a nested style object, which React Native cannot use. */
function isNested(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `style` without the web-only keys: `label`, and every key that holds an object (selectors, media
 * queries). A style written for both platforms has a `native` part, which is merged over the rest, and a
 * `web` part, which is dropped.
 */
export function toNativeStyle(style: Record<string, unknown>): NativeStyleObject {
  const { web: _web, native, ...rest } = style
  const merged = isNested(native) ? { ...rest, ...(native as Record<string, unknown>) } : rest
  const resolved = Object.fromEntries(
    Object.entries(merged).filter(([key, value]) => key !== 'label' && !isNested(value))
  )
  warnAboutValues(resolved)
  return resolved as NativeStyleObject
}
