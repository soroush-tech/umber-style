// A namespace import: the server build of React has no `createContext` and no `use`, and a server that
// loads the server build of this package with no bundler still loads the client modules that import this
// one. So nothing here calls React when the module loads.
import * as React from 'react'
import { readSharedState, type UmberCache } from '@umber-style/core'
import type { StyleText } from './styleElements'

/** One style text that a request registered: the prefix of its engine, and the nonce it came with. */
interface RegisteredText extends StyleText {
  /** The prefix of the engine's cache: the first word of `data-umber` on the element that holds it. */
  readonly prefix: string
  /** The nonce the text came with: the request's (a source, the cache), or none. */
  readonly nonce?: string
}

/** What the style registry of one request holds, from the server render of its first HTML. */
export interface StyleRegistryStore {
  /** `<prefix> <href>` of each text registered in the request, so that each is written once. */
  readonly seen: Set<string>
  /** The texts registered and not written yet, in the order of registration. */
  readonly pending: RegisteredText[]
  /** The first nonce a text of the request came with: the nonce of the request. */
  nonce?: string
}

/** The texts that one element of a flush holds: those of one prefix, with one nonce, in order. */
export interface RegisteredGroup {
  /** The prefix of the engine's cache. */
  readonly prefix: string
  /** The nonce of the element. */
  readonly nonce?: string
  /** The `href` of each text. */
  readonly hrefs: readonly string[]
  /** The texts, joined. */
  readonly text: string
}

/** A new registry, empty: one for each request (and one for the page in the browser, where it stays empty). */
export function createRegistryStore(): StyleRegistryStore {
  return { seen: new Set(), pending: [] }
}

// The context of the registry, made on first use, and whether one has rendered in this program: until
// then no component reads the context, so that an app with none pays nothing. Shared by every copy of the
// binding in the program.
const shared = readSharedState('react.style-registry@1', () => ({
  context: undefined as React.Context<StyleRegistryStore | undefined> | undefined,
  isRendered: false,
}))

/** The context of the registry, made on first use. */
export function getRegistryContext(): React.Context<StyleRegistryStore | undefined> {
  shared.context ??= React.createContext<StyleRegistryStore | undefined>(undefined)
  return shared.context
}

/** Records that a registry has rendered in this program: from now on the components read its context. */
export function markRegistryRendered(): void {
  shared.isRendered = true
}

/**
 * The registry of the nearest `StyleRegistry` above, or undefined with none (read only once one has
 * rendered). It reads the context with `use`, which React does not count among the hooks.
 */
export function useStyleRegistry(): StyleRegistryStore | undefined {
  return shared.isRendered ? React.use(getRegistryContext()) : undefined
}

/**
 * Adds to `store` each of `texts` that the request has not registered, with the prefix and the nonce
 * they came with. Only where there is no document (the server render of the first HTML): in the browser a
 * registry holds nothing, as nothing would write it.
 */
export function registerTexts(
  store: StyleRegistryStore,
  prefix: string,
  texts: readonly StyleText[],
  nonce: string | undefined
): void {
  if (typeof document !== 'undefined') return
  store.nonce ??= nonce
  for (const { href, text } of texts) {
    const key = `${prefix} ${href}`
    if (store.seen.has(key)) continue
    store.seen.add(key)
    store.pending.push({ prefix, href, text, ...(nonce !== undefined && { nonce }) })
  }
}

/**
 * Takes the texts registered since the last call, as the elements of one flush: one for each prefix and
 * nonce, in the order of their first text, each with its texts in order. A text that came with no nonce
 * gets the nonce of the request, when a text of the request came with one.
 */
export function takeRegistered(store: StyleRegistryStore): RegisteredGroup[] {
  const groups = new Map<string, { prefix: string; nonce?: string; texts: RegisteredText[] }>()
  for (const registered of store.pending.splice(0)) {
    const nonce = registered.nonce ?? store.nonce
    const key = `${registered.prefix} ${nonce ?? ''}`
    let group = groups.get(key)
    if (group === undefined) {
      group = { prefix: registered.prefix, nonce, texts: [] }
      groups.set(key, group)
    }
    group.texts.push(registered)
  }
  return [...groups.values()].map(({ prefix, nonce, texts }) => ({
    prefix,
    ...(nonce !== undefined && { nonce }),
    hrefs: texts.map(({ href }) => href),
    text: texts.map(({ text }) => text).join(''),
  }))
}

/** The style elements of a flush: `<style nonce data-umber="<prefix> <href>..." data-umber-registry>`, none when nothing is new. */
export function renderRegistered(store: StyleRegistryStore): React.ReactElement[] | null {
  const groups = takeRegistered(store)
  if (groups.length === 0) return null
  return groups.map(({ prefix, nonce, hrefs, text }) =>
    React.createElement(
      'style',
      {
        key: `${prefix} ${hrefs[0]}`,
        nonce,
        'data-umber': [prefix, ...hrefs].join(' '),
        'data-umber-registry': '',
      },
      text
    )
  )
}

// The registry that each cache given to a `StyleRegistry` writes its new rules to: that of the last
// registry that took the cache. Its `insert` is wrapped once.
const watchedCaches = new WeakMap<UmberCache, StyleRegistryStore>()

/**
 * Makes every group of rules that `cache` writes from now on, and has not written before, a text of
 * `store`, with the key of the cache as prefix and its nonce: the rules of the client components under the
 * `CacheProvider` of a `StyleRegistry`. `insert` is wrapped once for each cache; it calls the function it
 * wraps, so a wrapper of the app's own still sees every rule.
 */
export function watchCache(cache: UmberCache, store: StyleRegistryStore): void {
  const isWatched = watchedCaches.has(cache)
  watchedCaches.set(cache, store)
  if (isWatched) return
  const insert = cache.insert
  cache.insert = (selector, serialized, sheet, shouldCache) => {
    const { name, styles } = serialized
    if (cache.inserted[name] === undefined) {
      registerTexts(
        watchedCaches.get(cache) as StyleRegistryStore,
        cache.key,
        [{ href: name, text: styles }],
        cache.nonce
      )
    }
    insert.call(cache, selector, serialized, sheet, shouldCache)
  }
}
