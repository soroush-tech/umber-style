import {
  createCache as createEngineCache,
  createStyleSelector,
  type CacheOptions,
  type SerializedRule,
  type StyleObject,
  type UmberCache,
  type UmberSheet,
} from '@umber-style/core'

export type { SerializedRule, UmberCache, UmberSheet } from '@umber-style/core'

export interface UmberCacheOptions extends Omit<CacheOptions, 'prefix' | 'onInsert'> {
  /** The first part of every class name and variable, and the key of the style elements: the `prefix` of the engine's cache. Lowercase letters, digits and hyphens, starting with a letter. */
  key: string
}

/** `registered` that is also read by class name. */
function createRegistered(map: ReadonlyMap<string, StyleObject>): UmberCache['registered'] {
  return new Proxy(map, {
    get(target, property) {
      if (typeof property === 'string' && target.has(property)) return true
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as UmberCache['registered']
}

/**
 * Makes a cache keyed by `options.key`: the engine's cache (`createCache` of `@umber-style/core`, with the
 * key as its prefix and the other options as they are), with `key`, `compat`, `inserted`, `registered`,
 * `sheet` and `insert`. The engine calls `insert` for every group of rules it writes, so that a function
 * put in its place sees each new rule once.
 */
export default function createCache(options: UmberCacheOptions): UmberCache {
  const { key, ...rest } = options
  // `cache` is made below, before the engine writes a rule.
  const engineCache = createEngineCache({
    ...rest,
    prefix: key,
    onInsert: (name, styles) => cache.insert('', { name, styles }, cache.sheet, true),
  })
  const selector = createStyleSelector(key)
  // The document the cache serves: that of the sheet given (an iframe's), else the global one.
  const page = rest.sheet?.document ?? (typeof document === 'undefined' ? undefined : document)
  const sheet: UmberSheet = {
    get tags() {
      return page ? [...page.querySelectorAll<HTMLStyleElement>(selector)] : []
    },
  }
  const inserted: Record<string, string | true> = {}
  for (const tag of sheet.tags) {
    for (const name of (tag.dataset.umber ?? '').split(' ').slice(1)) inserted[name] = true
  }
  const cache: UmberCache = Object.assign(engineCache, {
    key,
    compat: false,
    inserted,
    registered: createRegistered(engineCache.registered),
    sheet,
    insert(
      _selector: string,
      serialized: SerializedRule,
      _sheet: UmberSheet,
      shouldCache: boolean
    ) {
      if (shouldCache) cache.inserted[serialized.name] = cache.compat ? serialized.styles : true
    },
  })
  return cache
}
