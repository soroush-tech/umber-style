// What one operation is, in this file, with the built React Native binding and production React over
// the stand-in platform module in `platform.ts`, whose `Pressable` calls a function `style` with
// `{ pressed }` on each render, as the platform's does:
//   48 pressables   one `renderToString` of a provider with 48 pressables of one look: opacity 1, 0.7
//                   while pressed, 0.4 when disabled (every fourth is disabled).
//                   "no state key"     a styled Pressable with the plain look only: the binding gives
//                                      it a style array, and the platform never renders it again on a
//                                      press. The cost of a Pressable with no state at all.
//                   "state keys"       a styled Pressable whose pressed and disabled looks are
//                                      `state()` keys: the binding gives it a function `style`.
//                   "own function"     the same look written by hand on the platform Pressable, with
//                                      no binding: a `style` function over two registered entries.
//   one press       the `style` function given to one pressable called again with `{ pressed: true }`,
//                   which is what the platform does when a finger goes down: the cost of the state
//                   keys on a press, against the hand-written function.
// A render before the measurement made each case's styles. The platform's own cost (native view
// creation, the touch system, style registration across the bridge) is not here.
import { createRequire } from 'node:module'
import type { BenchConfig } from '@soroush.tech/bench'
import type * as React from 'react'
import type * as ReactDomServer from 'react-dom/server'
import { createSetup, theme } from './fixtures'
import type * as Platform from './platform'
import type * as Binding from '../src/index'

const load = createRequire(import.meta.url)
const { createElement: h } = load('react') as typeof React
const { renderToString } = load('react-dom/server') as typeof ReactDomServer
const { at, state } = load('../dist/index.cjs') as typeof Binding
// The stand-in as the built binding loads it, by its specifier, so that its Pressable is the same object.
const { lastPressable, Pressable } = load('react-native') as typeof Platform

const { style } = createSetup()
const { styled, StyleSheet, ThemeProvider } = style
const Plain = styled(Pressable)({ opacity: 1, padding: 8 })
const Stateful = styled(Pressable)({
  opacity: 1,
  padding: 8,
  ...at(state('pressed'), { opacity: 0.7 }),
  ...at(state('disabled'), { opacity: 0.4 }),
})
const entries = StyleSheet.create({
  base: { opacity: 1, padding: 8 },
  pressed: { opacity: 0.7, padding: 8 },
  disabled: { opacity: 0.4, padding: 8 },
})
/** The look written by hand: the function an author gives the platform Pressable. */
const createOwnStyle =
  (isDisabled: boolean) =>
  ({ pressed }: { pressed: boolean }) => {
    if (isDisabled) return entries.disabled
    return pressed ? entries.pressed : entries.base
  }
const ownStyles = [createOwnStyle(false), createOwnStyle(true)]

type Look = 'plain' | 'stateful' | 'own'

/** 48 pressables of one look, every fourth disabled, inside a provider. */
function createPressables(look: Look): React.ReactElement {
  const children = Array.from({ length: 48 }, (_, key) => {
    const disabled = key % 4 === 3
    if (look === 'plain') return h(Plain, { key, disabled })
    if (look === 'stateful') return h(Stateful, { key, disabled })
    return h(Pressable, { key, disabled, style: ownStyles[Number(disabled)] })
  })
  return h(ThemeProvider, { theme }, children)
}

/** The operation: a render of the 48 pressables of `look`, after one render before it. */
function prepareRender(look: Look): () => string {
  const element = createPressables(look)
  renderToString(element)
  return () => renderToString(element)
}

/** The operation: the `style` function of one pressable of `look`, called as a press calls it. */
function preparePress(look: Look): () => unknown {
  const pressable = look === 'own' ? h(Pressable, { style: ownStyles[0] }) : h(Stateful)
  renderToString(h(ThemeProvider, { theme }, pressable))
  const press = lastPressable.style as (state: { pressed: boolean }) => unknown
  press({ pressed: true })
  return () => press({ pressed: true })
}

export default {
  name: 'react native: pressables with and without state keys',
  cases: {
    '48 pressables, no state key': prepareRender('plain'),
    '48 pressables, state keys': prepareRender('stateful'),
    '48 pressables, own function': prepareRender('own'),
    'one press, state keys': preparePress('stateful'),
    'one press, own function': preparePress('own'),
  },
} satisfies BenchConfig
