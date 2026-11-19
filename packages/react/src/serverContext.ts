import { cache as reactCache, type ReactNode } from 'react'

/** The state of one request: the value, and whether a provider has written it. */
export interface ServerSlot<T> {
  current: T
  isSet: boolean
}

/** What makes the slot of a request: `React.cache`, or a function with the same contract. */
export type CacheFunction = <R>(make: () => R) => () => R

export interface ServerOnlyContext<T> {
  /** Writes `value` to the slot of the request when no provider has yet, then renders its children. */
  Provider(props: { value: T; children?: ReactNode }): ReactNode
  /** The slot of the current request. */
  slot(): ServerSlot<T>
}

/**
 * A context for server components, which have no React context: its value is a slot that
 * `React.cache` keeps for the length of one request. A server component can render out of order,
 * and a nested provider must not change what the root gave, so only the first provider that renders
 * in a request writes the slot; the later ones leave it as it is.
 */
export function createServerOnlyContext<T>(
  defaultValue: T,
  cache: CacheFunction = reactCache
): ServerOnlyContext<T> {
  const slot = cache((): ServerSlot<T> => ({ current: defaultValue, isSet: false }))

  function Provider({ value, children }: { value: T; children?: ReactNode }) {
    const state = slot()
    if (!state.isSet) {
      state.current = value
      state.isSet = true
    }
    return children
  }

  return { Provider, slot }
}

/** The value of the slot of the current request: the default until a provider has written it. */
export function readServerContext<T>(context: ServerOnlyContext<T>): T {
  return context.slot().current
}
