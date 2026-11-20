import { createElement, Fragment, type ReactElement } from 'react'
import type { Engine } from '@umber-style/core'
import { createGlobalElements } from './styleElements'
import type { GlobalProps } from './types'

/**
 * Makes `Global` for server components: no hook, no context. A function of the theme reads the view of
 * the theme that `readTheme` gives, the root theme of the request (references for tokens, real values for
 * raw keys), or the references of the engine while it has no theme. The rules are written into the cache
 * for good, as a server unmounts nothing, and sent as the style elements of each set and of the
 * animations it uses: React sends each `href` once.
 */
export function createGlobal<T>(engine: Engine<T>, readTheme: () => T) {
  return function Global({ styles }: GlobalProps<T>): ReactElement {
    const view = engine.hasTheme ? engine.createThemeView(readTheme()) : undefined
    const sets = engine.resolveGlobal(styles, view)
    for (const set of sets) engine.cache.insertGlobal(set)
    return createElement(Fragment, null, ...createGlobalElements(engine.cache, sets))
  }
}
