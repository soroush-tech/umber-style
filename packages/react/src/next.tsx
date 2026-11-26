'use client'

import { createElement, useState, type ReactElement, type ReactNode } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import type { UmberCache } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import {
  createRegistryStore,
  getRegistryContext,
  markRegistryRendered,
  renderRegistered,
  watchCache,
} from './styleRegistry'

/** The props of `StyleRegistry`. */
export interface StyleRegistryProps {
  /** The page, or the part of it whose styles the registry writes. */
  readonly children?: ReactNode
  /**
   * A cache made for the request (`createCache({ key })` of `@umber-style/cache`), which a `CacheProvider`
   * gives the client components below: the registry writes the rules it gets. Without one the client
   * components keep the engine's own cache, and the registry writes the rules of their classes.
   */
  readonly cache?: UmberCache
}

/**
 * The style registry of the Next.js App Router, added once around the page in the root layout. In the
 * server render of the first HTML it collects the style texts of the request: of the components of the
 * server build (under a nonce, which otherwise sends them in place), of the client components (the rules
 * of `cache`, or of the classes, the theme and the global rules of each style), and writes them with
 * `useServerInsertedHTML`, which Next.js calls on every flush: in the head for the first piece of the
 * stream, at the top of the body before each later one, with the nonce the texts came with. A style
 * element of the page is never among its elements. A client-side navigation sends no HTML: its rules are
 * written by the browser, after the last style element of the engine.
 */
export function StyleRegistry({ children, cache }: StyleRegistryProps): ReactElement {
  const [store] = useState(createRegistryStore)
  if (cache !== undefined) watchCache(cache, store)
  markRegistryRendered()
  useServerInsertedHTML(() => renderRegistered(store))
  const content =
    cache === undefined ? children : createElement(CacheProvider, { value: cache }, children)
  return createElement(getRegistryContext().Provider, { value: store }, content)
}
