'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** The options of `useMediaQuery`. */
export interface MediaQueryOptions {
  /** The answer on the server and in the first render of a hydration, where there is no window. Default false. */
  defaultMatches?: boolean
}

/**
 * Whether the media query `query` (as `matchMedia` takes it: `(min-width: 600px)`) matches, for what a
 * style cannot do: render one structure or another. The component renders again when the answer
 * changes. On the server, and in the first render of a hydration, it is `defaultMatches` (false unless
 * given), so that the HTML of the server and the hydration agree; the browser's answer follows at once.
 * It uses a hook, so it is not in the server-components build.
 */
export function useMediaQuery(query: string, options: MediaQueryOptions = {}): boolean {
  const { defaultMatches = false } = options
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => defaultMatches
  )
}
