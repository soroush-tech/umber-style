import {
  createCache as createEngineCache,
  createStyleSelector,
  type Cache,
  type CacheOptions,
  type StyleObject,
} from '@umber-style/core'

/** A group of rules that the cache wrote: its name, and its CSS text as written (layer included). */
export interface SerializedRule {
  name: string
  styles: string
}

/** The style elements of a cache. */
export interface UmberSheet {
  /**
   * The style elements that hold the rules of the cache, in document order: its own, and those on the
   * page with its key (`data-umber="<key> ..."`, `data-umber="<key>-global ..."`). None without a document.
   */
  readonly tags: HTMLStyleElement[]
}

export interface UmberCacheOptions extends Omit<CacheOptions, 'prefix' | 'onInsert'> {
  /** The first part of every class name and variable, and the key of the style elements: the `prefix` of the engine's cache. Lowercase letters, digits and hyphens, starting with a letter. */
  key: string
}

/** The engine's cache, with the members that server-rendering setups read and wrap. */
export interface UmberCache extends Cache {
  /** The key the cache was made with: its prefix. */
  readonly key: string
  /** Whether `inserted` holds the CSS text of each rule (`true`), or only `true` (`false`, the default). */
  compat: boolean
  /** Each group of rules written since the cache was made, by name: its CSS text when `compat` is set, else `true`. The names of the `data-umber` elements on the page at start-up are `true`. */
  inserted: Record<string, string | true>
  /** The style object of each class this cache made (a map), also readable by class name: `registered[className]` is `true` for such a class. */
  readonly registered: ReadonlyMap<string, StyleObject> & { readonly [className: string]: unknown }
  readonly sheet: UmberSheet
  /**
   * Called by the cache after it writes a group of rules (`selector` is '', `serialized` the name and
   * the CSS text, `shouldCache` true): it records the rules in `inserted`. Replace it with a function that
   * calls the one it replaces to see every new rule once.
   */
  insert(
    selector: string,
    serialized: SerializedRule,
    sheet: UmberSheet,
    shouldCache: boolean
  ): void
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
  const sheet: UmberSheet = {
    get tags() {
      if (typeof document === 'undefined') return []
      return [...document.querySelectorAll<HTMLStyleElement>(selector)]
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
