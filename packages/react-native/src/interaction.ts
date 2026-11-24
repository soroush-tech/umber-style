import { useState } from 'react'
import type { StateName } from '@umber-style/core'
import type { InteractionState } from './conditions'

/**
 * The states that a component learns from its own events and keeps: hover and focus, and the press of a
 * component that animates (its `style` must stay a list the animation library reads, not a function).
 */
export type HeldName = Extract<StateName, 'hovered' | 'focused' | 'pressed'>

/** The hover and focus that a component keeps, and how its handlers change them. */
export interface HeldStates {
  /** The states that hold now. */
  readonly states: InteractionState
  /** Sets one state; nothing renders again when it is already so. */
  readonly set: (name: HeldName, value: boolean) => void
}

/** The props a component is told a state with, for a component that does not report it itself. */
const STATE_PROPS: ReadonlySet<string> = new Set(['pressed', 'hovered', 'focused'])

/** The handlers that tell each held state, on and off: the ones `Pressable` takes. */
const HELD_EVENTS: Readonly<Record<HeldName, readonly [string, string]>> = {
  hovered: ['onHoverIn', 'onHoverOut'],
  focused: ['onFocus', 'onBlur'],
  pressed: ['onPressIn', 'onPressOut'],
}

const NO_STATES: InteractionState = {}

/** Whether `name` is one of the props that tell a state: `pressed`, `hovered`, `focused`. */
export function isStateProp(name: string): boolean {
  return STATE_PROPS.has(name)
}

/** Whether `name` is a state that every component that names it learns from its events and keeps: hover and focus. */
export function isHeldName(name: StateName): name is Exclude<HeldName, 'pressed'> {
  return name === 'hovered' || name === 'focused'
}

/**
 * What a component is doing, as its props and the states it keeps say: `disabled` from `disabled`,
 * `aria-disabled`, `accessibilityState.disabled` or `editable={false}` (a `TextInput`); `pressed`,
 * `hovered` and `focused` from the props of those names, or from `held`.
 */
export function readInteraction(
  props: Record<string, unknown>,
  held?: InteractionState
): InteractionState {
  const accessibilityState = props.accessibilityState as { disabled?: unknown } | undefined
  return {
    disabled:
      props.disabled === true ||
      props['aria-disabled'] === true ||
      accessibilityState?.disabled === true ||
      props.editable === false,
    pressed: props.pressed === true || held?.pressed === true,
    hovered: props.hovered === true || held?.hovered === true,
    focused: props.focused === true || held?.focused === true,
  }
}

/** The hover and focus of a component, kept as its state. */
export function useHeldStates(): HeldStates {
  const [states, setStates] = useState(NO_STATES)
  const set = (name: HeldName, value: boolean) =>
    setStates((current) => (current[name] === value ? current : { ...current, [name]: value }))
  return { states, set }
}

/**
 * The handlers that keep `names` in `held` (`onHoverIn` and `onHoverOut`, `onFocus` and `onBlur`), each
 * of which then calls the handler of that name in `props`, when there is one, with the event.
 */
export function createHeldHandlers(
  names: readonly HeldName[],
  props: Record<string, unknown>,
  held: HeldStates
): Record<string, (event: unknown) => void> {
  const handlers: Record<string, (event: unknown) => void> = {}
  for (const name of names) {
    const [on, off] = HELD_EVENTS[name]
    handlers[on] = (event) => {
      held.set(name, true)
      callHandler(props[on], event)
    }
    handlers[off] = (event) => {
      held.set(name, false)
      callHandler(props[off], event)
    }
  }
  return handlers
}

/** Calls `handler` with `event` when it is a function. */
function callHandler(handler: unknown, event: unknown): void {
  if (typeof handler === 'function') handler(event)
}
