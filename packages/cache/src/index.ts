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

/** The options of `createCache`: those of the engine's cache, with `key` in place of its `prefix`. */
export interface UmberCacheOptions extends Omit<CacheOptions, 'prefix' | 'onInsert'> {
  /** The first part of every class name and variable, and the key of the style elements: the `prefix` of the engine's cache. Lowercase letters, digits and hyphens, starting with a letter. */
  key: string
  /**
   * Kept for compatibility with what apps pass from the styling library they move from: `true` is
   * `hasRuleText: false` (rules written with `insertRule`), `false` is `hasRuleText: true` (rules as text).
   * `hasRuleText` wins when both are given.
   */
  speedy?: boolean
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
 * put in its place sees each new rule once. Throws a `TypeError` for an `onInsert` option, which the
 * cache sets itself.
 */
export default function createCache(options: UmberCacheOptions): UmberCache {
  // A type error already; a call from plain JavaScript would lose its function without a word.
  if ('onInsert' in options) {
    throw new TypeError(
      "createCache(): `onInsert` is the cache's own: it calls `insert` for every group of rules it writes. Replace `cache.insert` to see each rule."
    )
  }
  const { key, speedy, ...rest } = options
  const hasRuleText = rest.hasRuleText ?? (speedy === undefined ? undefined : !speedy)
  // `cache` is made below, before the engine writes a rule.
  const engineCache = createEngineCache({
    ...rest,
    hasRuleText,
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
