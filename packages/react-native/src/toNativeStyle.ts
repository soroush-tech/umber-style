import { readState, type StateName } from '@umber-style/core'
import { readCondition, type Condition } from '@umber-style/core/internal'
import { matchesCondition, type InteractionState, type NativeCondition } from './conditions'
import { isMediaKey, readMediaQuery, type WindowState } from './mediaQuery'
import type { NativeStyleObject } from './nativeStyle'
import type { Motion } from './types'
import { convertValues, DEFAULT_REM_BASE } from './units'
import { warnAboutDroppedKey, warnAboutValues } from './warnStyle'

/** What turning a style into a native style needs besides the style. */
export interface NativeSettings {
  /** The font size that `1rem` is; a `rem` or `em` length in a media query is this too. */
  readonly remBase: number
  /** The component or sheet entry the style belongs to, for the development warnings; undefined when it is not known. */
  readonly name?: string
  /** What runs the animation and transition keys, given with the `animated` option; without it they are dropped. */
  readonly motion?: Motion
}

/** What a style depends on besides itself, at any depth of its `native` part and of its condition, state and media parts. */
export interface StyleKeys {
  /** Whether it has a `when()` or `whenScheme()` key: then it depends on the providers above. */
  isConditional: boolean
  /** Whether it has a `whenScheme()` key, which the system color scheme decides when no provider does. */
  hasScheme: boolean
  /** Its media query keys, each once, in the order they are met. */
  queries: string[]
  /** The states its `state()` keys name, each once, in the order they are met: then it depends on what the component is doing. */
  states: StateName[]
}

/** What a key of a part stands for: a media query, a state, or a condition of the providers. */
type PartKey =
  | { readonly kind: 'media' }
  | { readonly kind: 'state'; readonly name: StateName }
  | Condition

const MEDIA_PART: PartKey = { kind: 'media' }

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

/** Whether `key` is an animation or transition property, or one of their shorthands. */
export function isMotionKey(key: string): boolean {
  return key.startsWith('animation') || key.startsWith('transition')
}

/**
 * Whether `style` has an animation or transition key, at any depth of its `native` part and of its
 * condition, state and media parts (its `web` part is not read): the component it belongs to animates.
 */
export function hasMotion(style: Record<string, unknown>): boolean {
  for (const key in style) {
    if (isMotionKey(key)) return true
    const value = style[key]
    if (!isNested(value)) continue
    const isPart = key === 'native' || readPartKey(key) !== undefined
    if (isPart && hasMotion(value)) return true
  }
  return false
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
    const part = readPartKey(key)
    if (part === undefined) continue
    found ??= { isConditional: false, hasScheme: false, queries: [], states: [] }
    addKey(found, key, part)
    found = collectKeys(value, found)
  }
  return found
}

/** What the key `key` of a part stands for, or undefined when it is not a media, state or condition key. */
function readPartKey(key: string): PartKey | undefined {
  if (isMediaKey(key)) return MEDIA_PART
  const name = readState(key)
  return name === undefined ? readCondition(key) : { kind: 'state', name }
}

/** Adds the key `key` of a part to `found`: a media query or a state once, else that there is a condition, and whether it is a scheme. */
function addKey(found: StyleKeys, key: string, part: PartKey): void {
  if (part.kind === 'media') {
    if (!found.queries.includes(key)) found.queries.push(key)
  } else if (part.kind === 'state') {
    if (!found.states.includes(part.name)) found.states.push(part.name)
  } else {
    found.isConditional = true
    found.hasScheme ||= part.kind === 'scheme'
  }
}

/** Whether the key `key` of a part is a media query that holds for `state`; with no `state` none does. */
function matchesMedia(key: string, state: WindowState | undefined, remBase: number): boolean {
  return state !== undefined && isMediaKey(key) && readMediaQuery(key).matches(state, remBase)
}

/**
 * `style` without the web-only keys: `label`, selectors (a key with `&` or one that starts with `:`),
 * at-rules, custom properties, and the `animation*` and `transition*` properties, each dropped whole; with
 * `settings.motion` (the `animated` option) those properties are kept and translated by it, one level at a
 * time, before the parts of that level are merged over them. Objects and arrays under any other key are kept
 * (`shadowOffset`, `transform`). A style written for both platforms has a `native` part, which is merged
 * over the rest, and a `web` part, which is dropped. A `when()` or `whenScheme()` key is a part that
 * applies when it matches `condition` (the nearest provider), a media query key one that applies when
 * it holds for `state` (the window), and a `state()` key one that applies when its state is `true` in
 * `interaction` (what the component is doing): the parts that apply are merged over the plain keys, in
 * the order they are written, as the web writes them after the base rule; with no `condition`, `state`
 * or `interaction` they are dropped. A string that is a length or a number becomes a number (`convertValues`).
 * In development a dropped key that is a mistake, and a value that is not converted, are warned about.
 */
export function toNativeStyle(
  style: Record<string, unknown>,
  condition?: NativeCondition,
  settings: NativeSettings = DEFAULT_SETTINGS,
  state?: WindowState,
  interaction?: InteractionState
): NativeStyleObject {
  const { web: _web, native, ...rest } = style
  const { name, remBase, motion } = settings
  const merged = isNested(native) ? { ...rest, ...native } : rest
  const resolved = Object.fromEntries(
    Object.entries(merged).filter(([key]) => {
      if (!isWebOnlyKey(key) || (motion !== undefined && isMotionKey(key))) return true
      warnAboutDroppedKey(key, name)
      return false
    })
  )
  // The keys of this level are translated before the parts are merged over them, as the web reads each
  // rule apart: a shorthand here is expanded, and a value that is not valid is dropped, at this level.
  motion?.translate(resolved, name)
  const matching = Object.entries(merged).filter(
    ([key, part]) =>
      isNested(part) &&
      (matchesCondition(key, condition, interaction) || matchesMedia(key, state, remBase))
  )
  for (const [, part] of matching)
    Object.assign(
      resolved,
      toNativeStyle(part as Record<string, unknown>, condition, settings, state, interaction)
    )
  convertValues(resolved, remBase)
  warnAboutValues(resolved, name)
  return resolved as NativeStyleObject
}
