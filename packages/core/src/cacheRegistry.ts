import type { Cache } from './cache'
import { readSharedState } from './sharedState'

// The cache of each prefix in each document: the first one made that writes into a style element there,
// by any copy of the core, so that code of another copy finds it.
const registry = readSharedState('core.caches@1', () => new WeakMap<Document, Map<string, Cache>>())

/** Records `cache` as the cache of its prefix in `page`, unless a cache of that prefix was recorded there before. */
export function registerCache(page: Document, cache: Cache): void {
  let caches = registry.get(page)
  if (caches === undefined) {
    caches = new Map()
    registry.set(page, caches)
  }
  if (!caches.has(cache.prefix)) caches.set(cache.prefix, cache)
}

/**
 * The cache of `prefix` in `page`: the first cache of that prefix made with a sheet in a style element of
 * that document (`createCache` records it), or undefined where none was made. It is how code that has no
 * engine of its own (a component that a server component renders, in the browser) reaches the cache of the
 * page, for example to release a global rule that a server sent.
 */
export function findCache(prefix: string, page: Document): Cache | undefined {
  return registry.get(page)?.get(prefix)
}
