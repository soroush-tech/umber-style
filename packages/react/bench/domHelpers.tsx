// What the benchmarks that render into jsdom share: a fresh style object with its components, the
// element of the tree, and a root with what ends it.
import type { CacheOptions } from '@umber-style/core'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { ReactElement, ReactNode } from 'react'
import { createStyle } from '../src/createStyle'
import { createBenchOptions, createComponents, theme, Tree } from './fixtures'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false

/** A fresh style object over a fresh in-memory cache, and the components over it. */
export function createSetup(options: CacheOptions = {}, hasCondition = false) {
  const style = createStyle(theme, createBenchOptions(options))
  return { style, components: createComponents(style, hasCondition) }
}
export type Setup = ReturnType<typeof createSetup>

/** The element to render for `shift`: a new element each time, so React renders it again. */
export function createApp(setup: Setup, shift: number): ReactElement {
  return (
    <setup.style.ThemeProvider theme={theme}>
      <Tree components={setup.components} shift={shift} />
    </setup.style.ThemeProvider>
  )
}

/** A container in the document with a root over it, and what ends it. */
export function mount() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    container,
    root,
    unmount: () => {
      flushSync(() => root.unmount())
      container.remove()
    },
  }
}

/** Renders `element` into `root` and commits it before returning. */
export const render = (root: Root, element: ReactNode) => flushSync(() => root.render(element))
