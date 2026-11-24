import { createElement, memo, useState, type ReactNode } from 'react'
import { vi } from 'vitest'

// What the animation library reads from the platform, for the tests of the animated entry.
export * from './vitest.library-platform'

type Handler = (...args: never[]) => void

/** The handlers of one stand-in event source, by event name, and a subscription that removes one. */
function createEvents() {
  const handlers = new Map<string, Set<Handler>>()
  const add = (name: string, handler: Handler) => {
    const set = handlers.get(name) ?? new Set()
    handlers.set(name, set)
    set.add(handler)
    return { remove: () => set.delete(handler) }
  }
  const emit = (name: string, ...args: never[]) => {
    for (const handler of handlers.get(name) ?? []) handler(...args)
  }
  const count = () => [...handlers.values()].reduce((total, set) => total + set.size, 0)
  return { add, emit, count }
}

const appearanceEvents = createEvents()
const dimensionEvents = createEvents()
const accessibilityEvents = createEvents()

// A stand-in for the platform StyleSheet: `create` records its input and returns it.
// A stand-in for the platform Appearance: the color scheme is whatever a test sets.
export const Appearance = {
  getColorScheme: vi.fn((): 'light' | 'dark' | null | undefined => 'light'),
  addChangeListener: vi.fn((handler: Handler) => appearanceEvents.add('change', handler)),
}

export const StyleSheet = {
  create: vi.fn(<T>(styles: T) => styles),
  flatten: vi.fn((style: unknown) => style),
  compose: vi.fn((first: unknown, second: unknown) => [first, second]),
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute' },
  absoluteFillObject: { position: 'absolute' },
}

// A stand-in for the platform Dimensions: the window is 400 by 800 until a test sets another size.
const size = { width: 400, height: 800 }
export const Dimensions = {
  get: vi.fn((_dimension: string) => ({ ...size, scale: 1, fontScale: 1 })),
  addEventListener: vi.fn((name: string, handler: Handler) => dimensionEvents.add(name, handler)),
}

// A stand-in for the platform AccessibilityInfo: reduced motion is off until a test sets it.
export const AccessibilityInfo = {
  isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
  addEventListener: vi.fn((name: string, handler: Handler) =>
    accessibilityEvents.add(name, handler)
  ),
}

type Props = Record<string, unknown>

/** What a test reads of one `Pressable` stand-in, and what a finger, a pointer or a keyboard does to it. */
export interface PressableRecord {
  /** How many times it rendered. */
  renders: number
  /** The props it rendered with last. */
  props: Props
  /** The style it gave its view last: its `style`, called with `{ pressed }` when it is a function. */
  style: unknown
  /** A finger goes down on it. */
  pressIn(): void
  /** The finger is lifted. */
  pressOut(): void
  /** A pointer enters it, where the platform reports hover. */
  hoverIn(): void
  /** The pointer leaves it. */
  hoverOut(): void
  /** It gets the focus. */
  focus(): void
  /** It loses the focus. */
  blur(): void
}

const pressables = new Map<string, PressableRecord>()

/** Calls the handler `name` of `props`, when there is one. */
function callHandler(props: Props, name: string): void {
  const handler = props[name]
  if (typeof handler === 'function') handler({ nativeEvent: {} })
}

/**
 * A stand-in for the platform Pressable, with the contract of `Libraries/Components/Pressable/Pressable.js`
 * of React Native 0.88.1: it keeps `pressed` as state (`usePressState`, 246 and 371-374) and sets it on a
 * press only when its `style` or `children` is a function (`shouldUpdatePressed`, 248-249, 308 and 323),
 * so that only then does a press render it again; it calls a function `style` and `children` with
 * `{ pressed }` (363-365); it is memoized and named `Pressable` (376-380). A disabled one is not pressed:
 * Pressability grants no touch to it. `onHoverIn`, `onHoverOut`, `onFocus` and `onBlur` are called as
 * Pressability calls them where the platform reports them. The timing of Pressability (130 ms at least
 * from press in to press out) is not modelled. It records what it rendered under its `testID`.
 */
function PressableStandIn(props: Props) {
  const { style, children, disabled, testID } = props
  const [pressed, setPressed] = useState(false)
  const shouldUpdatePressed = typeof children === 'function' || typeof style === 'function'
  const record = pressables.get(String(testID)) ?? ({ renders: 0 } as PressableRecord)
  pressables.set(String(testID), record)
  record.renders++
  record.props = props
  record.style = typeof style === 'function' ? style({ pressed }) : style
  const press = (isDown: boolean) => {
    if (disabled === true) return
    if (shouldUpdatePressed) setPressed(isDown)
    callHandler(props, isDown ? 'onPressIn' : 'onPressOut')
  }
  record.pressIn = () => press(true)
  record.pressOut = () => press(false)
  record.hoverIn = () => callHandler(props, 'onHoverIn')
  record.hoverOut = () => callHandler(props, 'onHoverOut')
  record.focus = () => callHandler(props, 'onFocus')
  record.blur = () => callHandler(props, 'onBlur')
  const content = typeof children === 'function' ? children({ pressed }) : children
  return createElement('view', null, content as ReactNode)
}

export const Pressable = memo(PressableStandIn)
Pressable.displayName = 'Pressable'

/** What the tests do to the stand-ins: what a user or the system would do on a device. */
export const platform = {
  /** Resizes (or rotates) the window and tells the listeners, as the platform does. */
  resize(width: number, height: number) {
    Object.assign(size, { width, height })
    dimensionEvents.emit('change')
  },
  /** Changes the system color scheme and tells the listeners. */
  setColorScheme(scheme: 'light' | 'dark' | null) {
    Appearance.getColorScheme.mockReturnValue(scheme)
    appearanceEvents.emit('change')
  },
  /** Turns reduced motion on or off in the system settings, which the platform reports as an event. */
  setReducedMotion(isEnabled: boolean) {
    accessibilityEvents.emit('reduceMotionChanged', isEnabled as never)
  },
  /** The `Pressable` stand-in rendered with this `testID`. */
  pressable(testID: string): PressableRecord {
    const record = pressables.get(testID)
    if (record === undefined) throw new Error(`No Pressable rendered with the testID "${testID}".`)
    return record
  },
  /** Forgets every `Pressable` stand-in rendered so far. */
  forgetPressables() {
    pressables.clear()
  },
  /** How many handlers the binding has on the platform's events now. */
  countListeners() {
    return appearanceEvents.count() + dimensionEvents.count() + accessibilityEvents.count()
  },
}
