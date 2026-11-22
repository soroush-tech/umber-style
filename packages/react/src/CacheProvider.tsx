'use client'

import { createContext, createElement, use, type ReactElement } from 'react'
import { readSharedState, type Cache } from '@umber-style/core'
import type { CacheProviderProps } from './types'

// The context of the cache that the nearest `CacheProvider` gives, and whether one has rendered: until
// then no component reads the context, so that an app that has none pays nothing. `use` may be called
// conditionally, and React does not count it among the hooks of a component, so a component that starts
// to read it keeps its hooks in order. Both are shared by every copy of the binding in the program, so
// that a component of one copy sees the provider of another.
const provided = readSharedState('react.cache-provider@1', () => ({
  context: createContext<Cache | undefined>(undefined),
  isProvided: false,
}))

/** The cache of the nearest `CacheProvider`, or undefined with none above (read only once one has rendered). */
export function useProvidedCache(): Cache | undefined {
  return provided.isProvided ? use(provided.context) : undefined
}

/**
 * Gives the subtree below it its cache: every rule that a component of the binding writes there goes to
 * `value` (classes, sheet entries, global rules, keyframes, the root theme and the theme classes of the
 * providers below), through the engine of the same theme over that cache. Outside any provider the
 * engine's own cache is used. Under it no `<style href precedence>` element is rendered on a server: the
 * app sends the rules of the cache itself (a registry, or `@umber-style/server`).
 */
export function CacheProvider({ value, children }: CacheProviderProps): ReactElement {
  provided.isProvided = true
  return createElement(provided.context.Provider, { value }, children)
}
