import { readCondition } from '@umber-style/core'
import { matchesCondition, type NativeCondition } from './conditions'
import { isMediaKey, readMediaQuery, type WindowState } from './mediaQuery'
import type { NativeStyleObject } from './nativeStyle'
import { convertValues, DEFAULT_REM_BASE } from './units'
import { warnAboutDroppedKey, warnAboutValues } from './warnStyle'

/** What turning a style into a native style needs besides the style. */
export interface NativeSettings {
  /** The font size that `1rem` is; a `rem` or `em` length in a media query is this too. */
  readonly remBase: number
  /** The component or sheet entry the style belongs to, for the development warnings; undefined when it is not known. */
  readonly name?: string
}

/** What a style depends on besides itself, at any depth of its `native` part and of its condition and media parts. */
export interface StyleKeys {
  /** Whether it has a `when()` or `whenScheme()` key: then it depends on the providers above. */
  isConditional: boolean
  /** Whether it has a `whenScheme()` key, which the system color scheme decides when no provider does. */
  hasScheme: boolean
  /** Its media query keys, each once, in the order they are met. */
  queries: string[]
}

const DEFAULT_SETTINGS: NativeSettings = { remBase: DEFAULT_REM_BASE }

/** Whether `value` is a plain object: the `native` part of a style. */
function isNested(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Whether the key `name` exists only on the web: a selector, an at-rule, a custom property, `label`, or
 * an `animation*` or `transition*` property (running an animation on React Native is not built yet).
 */
function isWebOnlyKey(name: string): boolean {
  return name === 'label' || name.includes('&') || /^(?::|@|--|animation|transition)/.test(name)
}

/**
 * The condition and media keys of `style`, added to `into` (see `StyleKeys`); undefined when there are
 * none and no `into`, so that a style without them costs no object.
 */
export function collectKeys(
  style: Record<string, unknown>,
  into?: StyleKeys
): StyleKeys | undefined {
  let found = into
  for (const key in style) {
    const value = style[key]
    if (!isNested(value)) continue
    if (key === 'native') {
      found = collectKeys(value, found)
      continue
    }
    const isMedia = isMediaKey(key)
    const condition = isMedia ? undefined : readCondition(key)
    if (!isMedia && condition === undefined) continue
    found ??= { isConditional: false, hasScheme: false, queries: [] }
    addKey(found, key, condition)
    found = collectKeys(value, found)
  }
  return found
}

/** Adds the key `key` of a part to `found`: a media query (no `condition`) once, else that there is a condition, and whether it is a scheme. */
function addKey(found: StyleKeys, key: string, condition: ReturnType<typeof readCondition>): void {
  if (condition === undefined) {
    if (!found.queries.includes(key)) found.queries.push(key)
  } else {
    found.isConditional = true
    found.hasScheme ||= condition.kind === 'scheme'
  }
}

/** Whether the key `key` of a part is a media query that holds for `state`; with no `state` none does. */
function matchesMedia(key: string, state: WindowState | undefined, remBase: number): boolean {
  return state !== undefined && isMediaKey(key) && readMediaQuery(key).matches(state, remBase)
}

/**
 * `style` without the web-only keys: `label`, selectors (a key with `&` or one that starts with `:`),
 * at-rules, custom properties, and the `animation*` and `transition*` properties, each dropped whole. Objects and arrays under any other key are kept
 * (`shadowOffset`, `transform`). A style written for both platforms has a `native` part, which is merged
 * over the rest, and a `web` part, which is dropped. A `when()` or `whenScheme()` key is a part that
 * applies when it matches `condition` (the nearest provider), and a media query key one that applies when
 * it holds for `state` (the window): the parts that apply are merged over the plain keys, in the order
 * they are written, as the web writes them after the base rule; with no `condition` or `state` they are
 * dropped. A string that is a length or a number becomes a number (`convertValues`).
 * In development a dropped key that is a mistake, and a value that is not converted, are warned about.
 */
export function toNativeStyle(
  style: Record<string, unknown>,
  condition?: NativeCondition,
  settings: NativeSettings = DEFAULT_SETTINGS,
  state?: WindowState
): NativeStyleObject {
  const { web: _web, native, ...rest } = style
  const { name, remBase } = settings
  const merged = isNested(native) ? { ...rest, ...native } : rest
  const resolved = Object.fromEntries(
    Object.entries(merged).filter(([key]) => {
      if (!isWebOnlyKey(key)) return true
      warnAboutDroppedKey(key, name)
      return false
    })
  )
  const matching = Object.entries(merged).filter(
    ([key, part]) =>
      isNested(part) && (matchesCondition(key, condition) || matchesMedia(key, state, remBase))
  )
  for (const [, part] of matching)
    Object.assign(
      resolved,
      toNativeStyle(part as Record<string, unknown>, condition, settings, state)
    )
  convertValues(resolved, remBase)
  warnAboutValues(resolved, name)
  return resolved as NativeStyleObject
}
