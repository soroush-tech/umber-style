import type { Cache } from './cache'
import type { StyleObject } from './serialize'

/** A group of rules that the cache wrote: its name, and its CSS text as written (layer included). */
export interface SerializedRule {
  /** The name of the group, as `CacheOptions.onInsert` gets it: a class, a theme class, a global id, `@keyframes:<name>`. */
  name: string
  /** The CSS text of the group, as the sheet got it. */
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

/**
 * The engine's cache, with the members that server-rendering setups read and wrap: what `createCache` of
 * `@umber-style/cache` makes. The type lives here, with the other types apps import, and that package
 * re-exports it.
 */
export interface UmberCache extends Cache {
  /** The key the cache was made with: its prefix. */
  readonly key: string
  /** Whether `inserted` holds the CSS text of each rule (`true`), or only `true` (`false`, the default). */
  compat: boolean
  /** Each group of rules written since the cache was made, by name: its CSS text when `compat` is set, else `true`. The names of the `data-umber` elements on the page at start-up are `true`. */
  inserted: Record<string, string | true>
  /** The style object of each class this cache made (a map), also readable by class name: `registered[className]` is `true` for such a class. */
  readonly registered: ReadonlyMap<string, StyleObject> & { readonly [className: string]: unknown }
  /** The style elements of the cache, which its `tags` lists. */
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
