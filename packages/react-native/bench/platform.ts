// A stand-in for the platform module, which Node cannot load: the built binding's `react-native` is
// sent here (`prepareBuiltPackages` in `fixtures.ts`). `StyleSheet.create` returns its input, as the
// stand-in of the tests does, but it is a plain function: it records nothing, so nothing grows with
// the operations. The colour scheme is light. React is loaded after `prepareBuiltPackages`, as the
// fixtures load it, so this is the same production copy.
import { createRequire } from 'node:module'
import type * as React from 'react'

const { createElement, memo, useState } = createRequire(import.meta.url)('react') as typeof React
export const Appearance = {
  getColorScheme: (): 'light' | 'dark' | null | undefined => 'light',
}

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  compose: (first: unknown, second: unknown) => [first, second],
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute' },
  absoluteFillObject: { position: 'absolute' },
}

/** The `style` that the last `Pressable` rendered was given, and what it gave its view: a press calls a function `style` again. */
export const lastPressable: { style: unknown; resolved: unknown } = {
  style: undefined,
  resolved: undefined,
}

/** Keeps what the last `Pressable` rendered with, for a benchmark of a press to call again. */
function recordPressable(style: unknown, resolved: unknown): void {
  lastPressable.style = style
  lastPressable.resolved = resolved
}

/**
 * A stand-in for the platform Pressable, as `Pressable.js` of React Native 0.88.1 renders: `pressed` is
 * its state (false in a render to a string, where no finger is down), and a function `style` is called
 * with `{ pressed }` on each render. It renders an empty element around its children.
 */
function PressableStandIn({
  style,
  children,
}: {
  style?: unknown
  disabled?: boolean
  children?: React.ReactNode
}) {
  const [pressed] = useState(false)
  const resolved =
    typeof style === 'function' ? (style as (state: object) => unknown)({ pressed }) : style
  recordPressable(style, resolved)
  return createElement('view', null, children)
}

export const Pressable = memo(PressableStandIn)
