// What one operation is, in this file: a slider thumb gets 50 new left sides one after the other, then
// one macrotask passes (in which a class that nothing holds any more is removed), in a document of jsdom that the file makes before React loads, so the
// client build runs as in a browser, with production React and the built binding. `setter` changes the
// value of `useStyleValue`: one declaration of a rule set in place, no render. `render` gives the new
// number as a prop and renders, with a plain object in `style`: a class for each number, written as it
// is first used, and the class of the number before removed after its delay, in the macrotask. The two
// cases compare with each other; jsdom computes no layout and paints nothing, so what a browser does
// after the change is not in either.
import type { BenchConfig } from '@soroush.tech/bench'
import { createRequire } from 'node:module'
import type * as React from 'react'
import type * as ReactDom from 'react-dom'
import type * as ReactDomClient from 'react-dom/client'
import { prepareBuiltPackages } from '../../../bench/src/built'
import type * as Binding from '../src/index'
import type { StyleValueSetter } from '../src/types'

prepareBuiltPackages()
const load = createRequire(import.meta.url)

// The document exists before React and the binding load: they read it as they start.
// jsdom has no types of its own here: the one constructor the file uses is typed by hand.
const { JSDOM } = load('jsdom') as {
  JSDOM: new (html: string) => { window: Window & typeof globalThis }
}
const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>')
// Node has a `navigator` of its own, which React reads as it is.
Object.assign(globalThis, {
  window,
  document: window.document,
  MutationObserver: window.MutationObserver,
})

const { createElement } = load('react') as typeof React
const { flushSync } = load('react-dom') as typeof ReactDom
const { createRoot } = load('react-dom/client') as typeof ReactDomClient
const binding = load('../dist/index.cjs') as typeof Binding

/** How many changes one operation makes, before its one macrotask: the wait for the timer would hide them otherwise. */
const CHANGES = 50

/** One macrotask: the delay after which a class that nothing holds is removed. */
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A root in the document with `element` rendered in it. */
function mount(element: React.ReactElement) {
  const container = window.document.createElement('div')
  window.document.body.appendChild(container)
  const root = createRoot(container)
  flushSync(() => root.render(element))
  return root
}

/** The case of the setter: the thumb reads a value, and the operation calls its setter. */
function prepareSetter(): () => Promise<unknown> {
  const style = binding.createStyle({}, { prefix: 'bs' })
  const Box = style.styled('div', { name: 'Thumb' })({ position: 'absolute' })
  let setLeft: StyleValueSetter = () => undefined
  function Thumb() {
    const [left, set] = style.useStyleValue(0, 'px')
    setLeft = set
    return createElement(Box, { style: { left: `${left}` } })
  }
  mount(createElement(Thumb))
  let step = 0
  return () => {
    for (let change = 0; change < CHANGES; change += 1) {
      step += 1
      setLeft(step % 1000)
    }
    return nextTask()
  }
}

/** The case of a render: the thumb takes the number as a prop, in a plain object in `style`. */
function prepareRender(): () => Promise<unknown> {
  const style = binding.createStyle({}, { prefix: 'br' })
  const Box = style.styled('div', { name: 'Thumb' })({ position: 'absolute' })
  const Thumb = ({ left }: { left: number }) => createElement(Box, { style: { left } })
  const root = mount(createElement(Thumb, { left: 0 }))
  let step = 0
  return () => {
    for (let change = 0; change < CHANGES; change += 1) {
      step += 1
      flushSync(() => root.render(createElement(Thumb, { left: step % 1000 })))
    }
    return nextTask()
  }
}

export default {
  name: 'react: a value that changes on every frame',
  cases: {
    '50 changes through the setter of useStyleValue, no render': prepareSetter(),
    '50 changes through a render with a plain object in style': prepareRender(),
  },
} satisfies BenchConfig
