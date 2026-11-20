import { readCondition } from '@umber-style/core'
import { matchesCondition, type NativeCondition } from './conditions'
import type { NativeStyleObject } from './nativeStyle'
import { convertValues, DEFAULT_REM_BASE } from './units'
import { warnAboutDroppedKey, warnAboutValues } from './warnStyle'

/** What turning a style into a native style needs besides the style. */
export interface NativeSettings {
  /** The font size that `1rem` is. */
  readonly remBase: number
  /** The component or sheet entry the style belongs to, for the development warnings; undefined when it is not known. */
  readonly name?: string
}

const DEFAULT_SETTINGS: NativeSettings = { remBase: DEFAULT_REM_BASE }

/** Whether `value` is a plain object: the `native` part of a style. */
function isNested(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Whether the key `name` exists only on the web: a selector, an at-rule, a custom property, `label`, or
 * an `animation*` or `transition*` property (running an animation on React Native is not built yet).
 */
function isWebOnlyKey(name: string): boolean {
  return name === 'label' || name.includes('&') || /^(?::|@|--|animation|transition)/.test(name)
}

/** Whether `style`, or its native part, has a `when()` or `whenScheme()` key: then the result depends on the providers above. */
export function hasConditions(style: Record<string, unknown>): boolean {
  const { native } = style
  const keys = [...Object.keys(style), ...(isNested(native) ? Object.keys(native as object) : [])]
  return keys.some((key) => readCondition(key) !== undefined)
}

/**
 * `style` without the web-only keys: `label`, selectors (a key with `&` or one that starts with `:`),
 * at-rules, custom properties, and the `animation*` and `transition*` properties, each dropped whole. Objects and arrays under any other key are kept
 * (`shadowOffset`, `transform`). A style written for both platforms has a `native` part, which is merged
 * over the rest, and a `web` part, which is dropped. A `when()` or `whenScheme()` key is a part that
 * applies when it matches `condition` (the nearest provider): it is merged over the rest, in order; with no
 * `condition` it is dropped. A string that is a length or a number becomes a number (`convertValues`).
 * In development a dropped key that is a mistake, and a value that is not converted, are warned about.
 */
export function toNativeStyle(
  style: Record<string, unknown>,
  condition?: NativeCondition,
  settings: NativeSettings = DEFAULT_SETTINGS
): NativeStyleObject {
  const { web: _web, native, ...rest } = style
  const merged = isNested(native) ? { ...rest, ...(native as Record<string, unknown>) } : rest
  const resolved = Object.fromEntries(
    Object.entries(merged).filter(([key]) => {
      if (!isWebOnlyKey(key)) return true
      warnAboutDroppedKey(key, settings.name)
      return false
    })
  )
  const matching = Object.entries(merged).filter(
    ([key, part]) => isNested(part) && matchesCondition(key, condition)
  )
  for (const [, part] of matching)
    Object.assign(resolved, toNativeStyle(part as Record<string, unknown>, condition, settings))
  convertValues(resolved, settings.remBase)
  warnAboutValues(resolved, settings.name)
  return resolved as NativeStyleObject
}
