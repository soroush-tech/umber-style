'use client'

import { createContext, createElement, use, type ReactElement } from 'react'
import type { Cache } from '@umber-style/core'
import type { CacheProviderProps } from './types'

/** The cache that the nearest `CacheProvider` gives, or undefined with none above. */
const CacheContext = createContext<Cache | undefined>(undefined)

// Whether a `CacheProvider` has rendered in this module: until then no component reads the context,
// so that an app that has none pays nothing. `use` may be called conditionally, and React does not count
// it among the hooks of a component, so a component that starts to read it keeps its hooks in order.
let isProvided = false

/** The cache of the nearest `CacheProvider`, or undefined with none above (read only once one has rendered). */
export function useProvidedCache(): Cache | undefined {
  return isProvided ? use(CacheContext) : undefined
}

/**
 * Gives the subtree below it its cache: every rule that a component of the binding writes there goes to
 * `value` (classes, sheet entries, global rules, keyframes, the root theme and the theme classes of the
 * providers below), through the engine of the same theme over that cache. Outside any provider the
 * engine's own cache is used. Under it no `<style href precedence>` element is rendered on a server: the
 * app sends the rules of the cache itself (a registry, or `@umber-style/server`).
 */
export function CacheProvider({ value, children }: CacheProviderProps): ReactElement {
  isProvided = true
  return createElement(CacheContext.Provider, { value }, children)
}
