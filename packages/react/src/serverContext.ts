import { cache as reactCache } from 'react'

/** The state of one request: the value, and whether a provider has written it. */
export interface ServerSlot<T> {
  /** The value of the request, the default until a provider writes it. */
  current: T
  /** Whether a provider has written `current` in this request. */
  isSet: boolean
}

/** What makes the slot of a request: `React.cache`, or a function with the same contract. */
export type CacheFunction = <R>(make: () => R) => () => R

/**
 * The slot of the current request, for server components, which have no React context: `React.cache`
 * keeps it for the length of one request, starting at `defaultValue`. It is never shared between two
 * requests, so nothing written there depends on the order in which requests come.
 */
export function createRequestSlot<T>(
  defaultValue: T,
  cache: CacheFunction = reactCache
): () => ServerSlot<T> {
  return cache((): ServerSlot<T> => ({ current: defaultValue, isSet: false }))
}
