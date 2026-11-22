import type { Engine } from '@umber-style/core'

/** The text of the warning, for a default style of the prefix `own` used under a cache of the key `provided`. */
export function createUnconfiguredMessage(own: string, provided: string): string {
  return (
    `[${own}] A component of the default style rendered under a CacheProvider whose cache has the key "${provided}", ` +
    `and the default style was never configured: it still has the prefix "${own}" and every default option. ` +
    `If it was meant to be configured, configure() did not run before the style was used. The usual causes: ` +
    `a configure() call in a module imported only for its side effect, which a bundler drops when the package says "sideEffects": false; ` +
    `or a configure() call that runs after the first styled() call. Call configure() from a function that the app calls ` +
    `before it renders (or list the module in "sideEffects"), or give the cache the key "${own}" if the default prefix is meant.`
  )
}

/**
 * Makes `engine.withCache` warn once, in the console, when it is given a cache whose prefix is not the
 * engine's: every component of the binding (a styled component, `Global`, `ThemeProvider`, `useStyle`)
 * calls it under a `CacheProvider`. The default style calls this for its engine in development only,
 * and only when `configure` was never called.
 */
export function watchProvidedCaches<T>(engine: Engine<T>): void {
  const { withCache } = engine
  let hasWarned = false
  engine.withCache = (cache) => {
    if (!hasWarned && cache.prefix !== engine.cache.prefix) {
      hasWarned = true
      console.warn(createUnconfiguredMessage(engine.cache.prefix, cache.prefix))
    }
    return withCache(cache)
  }
}
