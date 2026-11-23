import { isDevelopment } from './devChecks'

/** The interaction states a style can name with `state()`: the same four on every platform. */
export type StateName = 'hovered' | 'pressed' | 'focused' | 'disabled'

/**
 * The key of a style that applies while the element is in a state: `@state pressed`. It is typed as any
 * `@state` key, as the key of `when()` is typed as any `@theme` key, so that the style types of every
 * platform take it in an object literal and from `at`, alone or next to other keys.
 */
export type StateKey = `@state ${string}`

/**
 * The selector key each state is written as on the web: the one an author writes by hand for it, so
 * that a state key and that selector key give the same rules and the same class.
 */
export const STATE_SELECTORS: Readonly<Record<StateName, string>> = {
  hovered: '&:hover',
  pressed: '&:active',
  focused: '&:focus-visible',
  disabled: '&:disabled, &[aria-disabled="true"]',
}

const STATE_KEY = '@state '
const STATE_NAMES: ReadonlySet<string> = new Set(Object.keys(STATE_SELECTORS))

// The unknown names already warned about: each is warned about once.
const warnedNames = new Set<string>()

/**
 * The key of a style for "while the element is in the state `name`", to use with `at`:
 * `...at(state('pressed'), { opacity: 0.7 })`. On the web it is written as the selector of
 * `STATE_SELECTORS`; on React Native the binding follows the state of the component. In development
 * a name that is not one of the four is warned about once.
 */
export function state(name: StateName): StateKey {
  if (!STATE_NAMES.has(name) && !warnedNames.has(name) && isDevelopment()) {
    warnedNames.add(name)
    console.warn(
      `[umber-style] state(${JSON.stringify(name)}) names no state: the states are hovered, pressed, focused and disabled. Its key matches nothing: the web writes it as an at-rule that the browser drops, and React Native drops it.`
    )
  }
  return `${STATE_KEY}${name}`
}

/** The state that the style key `key` names, or undefined for any other key, and for a state key whose name is not one of the four. */
export function readState(key: string): StateName | undefined {
  if (!key.startsWith(STATE_KEY)) return undefined
  const name = key.slice(STATE_KEY.length)
  return STATE_NAMES.has(name) ? (name as StateName) : undefined
}
