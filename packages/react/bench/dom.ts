// What the files that render into a DOM load, in this order: the process is made to run built code
// (`prepareBuiltPackages`: production React, the built core), a document of jsdom is made and put on
// `globalThis` (React and the binding read it as they start), then React, `react-dom`, its client and
// server entries and the built binding are loaded. A file imports this module before anything that loads
// React. jsdom has no types of its own here: the one constructor used is typed by hand.
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import type * as React from 'react'
import type * as ReactDom from 'react-dom'
import type * as ReactDomClient from 'react-dom/client'
import type * as ReactDomServer from 'react-dom/server'
import { prepareBuiltPackages } from '../../../bench/src/built'
import type * as Binding from '../src/index'
import { createComponents, createFixtures, theme } from './fixtures'

prepareBuiltPackages()
const load = createRequire(import.meta.url)

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

export const { document } = window
export const { flushSync } = load('react-dom') as typeof ReactDom
export const { createRoot, hydrateRoot } = load('react-dom/client') as typeof ReactDomClient
export const { renderToString } = load('react-dom/server') as typeof ReactDomServer
export const binding = load('../dist/index.cjs') as typeof Binding
const core = load('../../core/dist/index.cjs') as typeof Core
const react = load('react') as typeof React
export const { createElement } = react
export const fixtures = createFixtures(react, core)

/**
 * A fresh style object of the client build and the components over it. Its cache writes into memory, as
 * in the other files, never into jsdom's style sheet, and has no development checks; `options` go on top.
 */
export function createSetup(options: Core.CacheOptions = {}) {
  const cache = core.createCache({
    prefix: 'b',
    sheet: core.createMemorySheet(),
    hasDevChecks: false,
    ...options,
  })
  const style = binding.createStyle(theme, { prefix: 'b', cache })
  return { style, components: createComponents(style) }
}
export type Setup = ReturnType<typeof createSetup>

/** A container in the document with a root over it, and what ends both. */
export function mount() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    root,
    unmount: () => {
      flushSync(() => root.unmount())
      container.remove()
    },
  }
}

/** Renders `element` into `root` and commits it before returning. */
export const render = (root: ReactDomClient.Root, element: React.ReactNode) =>
  flushSync(() => root.render(element))
