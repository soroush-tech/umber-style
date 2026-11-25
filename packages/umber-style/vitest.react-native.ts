import { createElement, memo, useState, type ReactNode } from 'react'
import { vi } from 'vitest'

// What the animation library reads from the platform, for the tests of the animated entry.
export * from '../react-native/vitest.library-platform'

// A stand-in for the platform StyleSheet: `create` records its input and returns it.
// A stand-in for the platform Appearance: the color scheme is whatever a test sets.
export const Appearance = {
  getColorScheme: vi.fn((): 'light' | 'dark' | null | undefined => 'light'),
  addChangeListener: vi.fn(() => ({ remove: () => {} })),
}

// Stand-ins for the platform Dimensions and AccessibilityInfo: a window of 400 by 800 that never
// changes, and reduced motion off.
export const Dimensions = {
  get: vi.fn((_dimension: string) => ({ width: 400, height: 800, scale: 1, fontScale: 1 })),
  addEventListener: vi.fn(() => ({ remove: () => {} })),
}

export const AccessibilityInfo = {
  isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
  addEventListener: vi.fn(() => ({ remove: () => {} })),
}

export const StyleSheet = {
  create: vi.fn(<T>(styles: T) => styles),
  flatten: vi.fn((style: unknown) => style),
  compose: vi.fn((first: unknown, second: unknown) => [first, second]),
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute' },
  absoluteFillObject: { position: 'absolute' },
}

/** What a test reads of the last `Pressable` stand-in rendered, and a finger on it. */
export const pressable = {
  /** The style it gave its view last: its `style`, called with `{ pressed }` when it is a function. */
  style: undefined as unknown,
  /** How many times it rendered. */
  renders: 0,
  /** A finger goes down on it (`true`) or is lifted. */
  press: (_isDown: boolean) => {},
}

/** Counts a render of the `Pressable` stand-in and keeps what it gave its view and how to press it. */
function recordPressable(style: unknown, press: (isDown: boolean) => void): void {
  pressable.renders++
  pressable.style = style
  pressable.press = press
}

/**
 * A stand-in for the platform Pressable with the contract of `Pressable.js` of React Native 0.88.1 (the
 * stand-in of `@umber-style/react-native` says which lines): `pressed` is its state, set on a press only
 * when `style` or `children` is a function, which it calls with `{ pressed }`; it is memoized and named
 * `Pressable`; a disabled one is not pressed.
 */
function PressableStandIn(props: Record<string, unknown>) {
  const { style, children, disabled } = props
  const [pressed, setPressed] = useState(false)
  const shouldUpdatePressed = typeof children === 'function' || typeof style === 'function'
  recordPressable(typeof style === 'function' ? style({ pressed }) : style, (isDown) => {
    if (disabled !== true && shouldUpdatePressed) setPressed(isDown)
  })
  const content = typeof children === 'function' ? children({ pressed }) : children
  return createElement('view', null, content as ReactNode)
}

export const Pressable = memo(PressableStandIn)
Pressable.displayName = 'Pressable'
