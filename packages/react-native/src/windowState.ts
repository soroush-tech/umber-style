import { useSyncExternalStore } from 'react'
import { readMediaQuery, type WindowState } from './mediaQuery'
import { platformAccessibility, platformAppearance, platformDimensions } from './platform'
import { warnAboutQuery } from './warnStyle'

/** The options of `useMediaQuery`. */
export interface MediaQueryOptions {
  /** The answer of a render to a string, where there is no window. Default false. */
  defaultMatches?: boolean
}

/**
 * Whether the system asks for reduced motion. The platform answers asynchronously, so this is false (no
 * preference, the platform's default) until it does: the answer is asked for when the first component
 * subscribes, and a change re-renders the components whose queries it changes.
 */
let isReducedMotion = false
const listeners = new Set<() => void>()
const subscriptions: { remove(): void }[] = []

/** Tells every subscriber that the window or a system setting changed. */
function notify(): void {
  for (const listener of listeners) listener()
}

function setReducedMotion(value: boolean): void {
  if (value === isReducedMotion) return
  isReducedMotion = value
  notify()
}

/** Whether the system asks for reduced motion, as the platform last answered (false until it answers). */
export function readReducedMotion(): boolean {
  return isReducedMotion
}

/** The window and the system settings now: the size and the color scheme are read from the platform, reduced motion is the last answer. */
export function readWindowState(): WindowState {
  const { width, height } = platformDimensions.get('window')
  return { width, height, colorScheme: platformAppearance.getColorScheme(), isReducedMotion }
}

/**
 * Subscribes `listener` to the changes of the window size, the system color scheme and reduced motion.
 * The binding listens to the platform once, for all its subscribers, while it has any.
 */
export function subscribeToWindow(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    subscriptions.push(
      platformDimensions.addEventListener('change', notify),
      platformAppearance.addChangeListener(notify),
      platformAccessibility.addEventListener('reduceMotionChanged', setReducedMotion)
    )
    // A platform that fails to answer leaves the value as it was: no preference until a change says otherwise.
    void platformAccessibility.isReduceMotionEnabled().then(setReducedMotion, () => undefined)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0)
      for (const subscription of subscriptions.splice(0)) subscription.remove()
  }
}

const subscribeToNothing = () => () => {}
const readNothing = () => ''

/**
 * The key of what `queries` give now: one character for each, `1` where it matches, then the system
 * color scheme when `hasScheme` (for a `whenScheme()` key that no provider decides), then whether the
 * system asks for reduced motion when `hasMotion` (for a component that animates). Two renders with the
 * same key resolve the same style.
 */
export function readMediaKey(
  queries: readonly string[],
  hasScheme: boolean,
  remBase: number,
  hasMotion = false
): string {
  let key = ''
  if (queries.length > 0) {
    const state = readWindowState()
    for (const query of queries) key += readMediaQuery(query).matches(state, remBase) ? '1' : '0'
  }
  if (hasScheme) key += `:${String(platformAppearance.getColorScheme())}`
  if (!hasMotion) return key
  return `${key}|${isReducedMotion ? 'reduce' : 'motion'}`
}

/**
 * `readMediaKey` in a component, which renders again when the key changes, not when the width changes
 * inside the same set of matching queries. With no query, no scheme and no motion it subscribes to nothing.
 */
export function useMediaKey(
  queries: readonly string[],
  hasScheme: boolean,
  remBase: number,
  hasMotion = false
): string {
  const read =
    queries.length > 0 || hasScheme || hasMotion
      ? createKeyReader(queries, hasScheme, remBase, hasMotion)
      : readNothing
  return useSyncExternalStore(
    read === readNothing ? subscribeToNothing : subscribeToWindow,
    read,
    read
  )
}

/** `readMediaKey` of these arguments; made apart, so that a component that watches nothing makes no function. */
function createKeyReader(
  queries: readonly string[],
  hasScheme: boolean,
  remBase: number,
  hasMotion: boolean
) {
  return () => readMediaKey(queries, hasScheme, remBase, hasMotion)
}

/**
 * Whether the media query `query` matches the window, on the store and the parser of the media keys of
 * styles; the component renders again when the answer changes. A query the binding cannot evaluate is
 * false, with a development warning. A render to a string gives `defaultMatches`.
 */
export function useMediaMatch(query: string, options: MediaQueryOptions, remBase: number): boolean {
  const { matches, problem } = readMediaQuery(query)
  if (problem !== undefined) warnAboutQuery(query, problem)
  return useSyncExternalStore(
    problem === undefined ? subscribeToWindow : subscribeToNothing,
    () => matches(readWindowState(), remBase),
    () => options.defaultMatches ?? false
  )
}
