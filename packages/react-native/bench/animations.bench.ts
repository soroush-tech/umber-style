// What one operation is, in this file, with the built React Native binding and production React over the
// stand-ins of the platform (`platform.ts`) and of the animation library (`reanimated.ts`): one
// `renderToString` of a provider with 48 views of one look, after one render before it.
//   no animation             a styled view with a fixed style, no `animated` option: the binding of today.
//   no animation, entry      the same view, with `createStyle(theme, { animated })`: what the entry costs a
//                            component whose styles do not animate.
//   animation, no entry      a skeleton whose style has `animation: <pulse> 1.5s ease-in-out infinite`,
//                            without the entry: the keys are dropped (no warning in production).
//   animation, entry         the same skeleton with the entry: the style keeps the translated keys, and
//                            the component is the animated form of the view (the stand-in returns the view).
//   function style           a function style that returns the same animation on each render, without and
//                            with the entry: with it the keys are translated on each render, as a function
//                            style is resolved (the reading of each text is remembered).
// The library's own work (normalizing the style, the native side) is not here.
import { createRequire } from 'node:module'
import type { BenchConfig } from '@soroush.tech/bench'
import type * as React from 'react'
import type * as ReactDomServer from 'react-dom/server'
import { theme } from './fixtures'
import type * as Entry from '../src/animated'
import type * as Binding from '../src/index'

const load = createRequire(import.meta.url)
const { createElement: h } = load('react') as typeof React
const { renderToString } = load('react-dom/server') as typeof ReactDomServer
const { createStyle, keyframes } = load('../dist/index.cjs') as typeof Binding
const { animated } = load('../dist/animated.cjs') as typeof Entry

/** A stand-in for a native view: it renders an empty element and drops its props. */
const View = () => h('view')

const pulse = keyframes({ '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, { label: 'pulse' })
const still = { opacity: 1, padding: 8 }
const skeleton = { opacity: 1, padding: 8, animation: `${pulse} 1.5s ease-in-out infinite` }

type Look = 'still' | 'skeleton' | 'function'

/** The operation: a render of 48 views of `look`, with or without the entry, after one render before it. */
function prepare(look: Look, hasEntry: boolean): () => string {
  const style = createStyle(theme, hasEntry ? { animated } : {})
  const { styled, ThemeProvider } = style
  const objectStyle = look === 'still' ? still : skeleton
  const Component = look === 'function' ? styled(View)(() => skeleton) : styled(View)(objectStyle)
  const children = Array.from({ length: 48 }, (_, key) => h(Component, { key }))
  const element = h(ThemeProvider, { theme }, children)
  renderToString(element)
  return () => renderToString(element)
}

export default {
  name: 'react native: animations through the animated entry',
  cases: {
    '48 views, no animation': prepare('still', false),
    '48 views, no animation, entry': prepare('still', true),
    '48 views, animation, no entry': prepare('skeleton', false),
    '48 views, animation, entry': prepare('skeleton', true),
    '48 views, function style, no entry': prepare('function', false),
    '48 views, function style, entry': prepare('function', true),
  },
} satisfies BenchConfig
